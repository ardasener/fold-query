use std::sync::Arc;

use serde::Deserialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

use crate::{llm, provider, sidecar};

const MAX_ITERATIONS: usize = 20;

const SYSTEM_PROMPT: &str = r#"You are the CAD assistant inside FoldQuery, a desktop app that builds 3D models with CadQuery and turns them into papercraft templates.

Your job is to help the user write and refine CadQuery scripts. Rules:
- The CURRENT CadQuery script is always provided to you in the conversation context (a system message that is updated before every reply). Read it there before deciding what to edit — never assume what the code contains.
- The script must produce a solid and call `show_object(result)` to display it.
- Always run the script after editing it and fix errors until it succeeds.
- Prefer building shapes with `cq.Workplane(...)` chains.
- When you need API details (method names, parameters, behavior), use the get_docs tool with a symbol path like "Workplane.box" or "Workplane".
- OWN YOUR EDITS: when you edit the code, describe the result as your own work ("I added the hole", "my edit changed X to Y"). Never describe the effects of your own edit_code calls as pre-existing features or as if you found them already there. The diff in the edit_code result tells you exactly what you changed.
- Keep responses concise; explain only what matters."#;

#[derive(Default)]
pub struct AgentSession {
    history: Vec<serde_json::Value>,
    pub source: String,
    pub last_result: Option<crate::python::ScriptResult>,
    /// Cumulative count of user messages dropped from the history by trimming.
    dropped_user_messages: usize,
    /// The active project this session belongs to (None until a project loads).
    pub project_id: Option<String>,
}

pub struct AgentState {
    inner: Arc<Mutex<AgentSession>>,
}

impl Default for AgentState {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(AgentSession::new())),
        }
    }
}

impl AgentSession {
    fn new() -> Self {
        Self {
            history: vec![json!({
                "role": "system",
                "content": SYSTEM_PROMPT,
            })],
            source: String::new(),
            last_result: None,
            dropped_user_messages: 0,
            project_id: None,
        }
    }

    fn reset(&mut self) {
        *self = Self::new();
    }

    fn push(&mut self, message: serde_json::Value) {
        self.history.push(message);
    }

    /// Trim the history to the budget and emit the boundary indicator when
    /// user messages were dropped.
    async fn trim_to(&mut self, app: AppHandle, budget: usize) {
        let dropped = trim_history(&mut self.history, budget);
        if dropped > 0 {
            self.dropped_user_messages += dropped;
            let _ = app.emit(
                "agent-context-trimmed",
                json!({ "droppedUserMessages": self.dropped_user_messages }),
            );
        }
    }
}

const CONTEXT_BUDGET_MIN: usize = 4_000;
const CONTEXT_BUDGET_MAX: usize = 200_000;

fn clamp_budget(budget: usize) -> usize {
    budget.clamp(CONTEXT_BUDGET_MIN, CONTEXT_BUDGET_MAX)
}

fn history_chars(history: &[serde_json::Value]) -> usize {
    history
        .iter()
        .map(|m| serde_json::to_string(m).map(|s| s.len()).unwrap_or(0))
        .sum()
}

/// Drops the oldest complete user turns (a user message plus everything after
/// it until the next user message) until the history fits the budget. Keeps
/// the system prompt and at least the most recent turn. Returns how many user
/// messages were dropped.
fn trim_history(history: &mut Vec<serde_json::Value>, budget: usize) -> usize {
    let mut dropped = 0;
    while history_chars(history) > budget {
        // First user message (the system prompt sits at index 0).
        let Some(first_user) = history
            .iter()
            .position(|m| m.get("role").and_then(|r| r.as_str()) == Some("user"))
        else {
            break;
        };
        // The next user message ends this turn; if none, this is the last turn — keep it.
        let Some(offset) = history[first_user + 1..]
            .iter()
            .position(|m| m.get("role").and_then(|r| r.as_str()) == Some("user"))
        else {
            break;
        };
        let end = first_user + 1 + offset;
        history.drain(first_user..end);
        dropped += 1;
    }
    dropped
}

fn tools() -> Vec<serde_json::Value> {
    vec![
        json!({
            "type": "function",
            "function": {
                "name": "edit_code",
                "description": "Replace the entire CadQuery script with new source code. The editor and session update immediately.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "code": { "type": "string", "description": "The complete new CadQuery script." }
                    },
                    "required": ["code"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "run_script",
                "description": "Execute the current CadQuery script and return its output, errors, and shown objects. Call this after every edit to verify the model.",
                "parameters": { "type": "object", "properties": {} }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_docs",
                "description": "Read documentation for a CadQuery symbol. Use a dotted path such as 'Workplane.box' or 'Workplane'.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "symbol": { "type": "string", "description": "Dotted symbol path, e.g. Workplane.box" }
                    },
                    "required": ["symbol"]
                }
            }
        }),
    ]
}

fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        text.to_string()
    } else {
        let mut truncated: String = text.chars().take(max).collect();
        truncated.push_str("\n…[truncated]");
        truncated
    }
}

/// Set-based line diff summary between the previous and new script, so the
/// model knows exactly what its edit changed.
fn code_changes(old: &str, new: &str) -> String {
    if old == new {
        return "No changes".to_string();
    }
    let old_lines: Vec<&str> = old.lines().collect();
    let new_lines: Vec<&str> = new.lines().collect();
    let added: Vec<&str> = new_lines
        .iter()
        .filter(|l| !old_lines.contains(l))
        .copied()
        .collect();
    let removed: Vec<&str> = old_lines
        .iter()
        .filter(|l| !new_lines.contains(l))
        .copied()
        .collect();

    let mut out = String::new();
    if !removed.is_empty() {
        out.push_str(&format!("Removed {} line(s):\n", removed.len()));
        for line in removed {
            out.push_str(&format!("  - {line}\n"));
        }
    }
    if !added.is_empty() {
        out.push_str(&format!("Added {} line(s):\n", added.len()));
        for line in added {
            out.push_str(&format!("  + {line}\n"));
        }
    }
    if out.is_empty() {
        out.push_str("Lines were rearranged but nothing added or removed.");
    }
    out
}

fn emit_status(app: &AppHandle, activity: &str, label: &str) {
    let _ = app.emit(
        "agent-status",
        json!({ "activity": activity, "label": label }),
    );
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatInput {
    pub message: String,
    pub source: String,
    pub url: String,
    pub model: String,
    pub context_budget: usize,
}

pub async fn chat_message(app: AppHandle, input: ChatInput) -> Result<(), String> {
    let api_key = provider::get_api_key()?;
    let budget = clamp_budget(input.context_budget);

    let state = app.state::<AgentState>();
    let mut session = state.inner.lock().await;
    session.source = input.source;
    session.push(json!({ "role": "user", "content": input.message }));
    session.trim_to(app.clone(), budget).await;

    emit_status(&app, "thinking", "Thinking");

    for _ in 0..MAX_ITERATIONS {
        session.trim_to(app.clone(), budget).await;
        let mut messages = session.history.clone();
        // Inject the current script so the model always sees exactly what it
        // can edit/run, refreshed after every edit_code call.
        if !session.source.trim().is_empty() {
            messages.insert(
                1,
                json!({
                    "role": "system",
                    "content": format!(
                        "Current CadQuery script (source of truth for edit_code and run_script):\n```python\n{}\n```",
                        session.source
                    ),
                }),
            );
        }
        let tools = tools();

        // Streaming attempt; fall back to non-streaming on any stream failure.
        let delta_app = app.clone();
        let reasoning_app = app.clone();
        let streamed = llm::stream_chat(
            &input.url,
            &api_key,
            &input.model,
            &messages,
            &tools,
            move |delta| {
                let _ = delta_app.emit("agent-token", json!({ "delta": delta }));
            },
            move |reasoning| {
                let _ = reasoning_app.emit("agent-reasoning", json!({ "delta": reasoning }));
            },
        )
        .await;

        let result = match streamed {
            Ok(r) => r,
            Err(stream_err) => {
                llm::chat(&input.url, &api_key, &input.model, &messages, &tools)
                    .await
                    .map_err(|e| format!("Chat request failed (streaming also failed: {stream_err}): {e}"))?
            }
        };

        let content = result.content;
        if result.tool_calls.is_empty() {
            session.push(json!({ "role": "assistant", "content": content }));
            if let Some(pid) = session.project_id.clone() {
                let _ = crate::project::save_chat(&app, &pid, &session.history);
            }
            let _ = app.emit(
                "agent-done",
                json!({
                    "message": content,
                    "source": session.source,
                    "scriptResult": session.last_result,
                }),
            );
            return Ok(());
        }

        // Record the assistant turn (content may be empty when only tools ran).
        let mut assistant = json!({ "role": "assistant" });
        if !content.trim().is_empty() {
            assistant["content"] = json!(content);
        }
        assistant["tool_calls"] = json!(
            result
                .tool_calls
                .iter()
                .map(|t| {
                    json!({
                        "id": t.id.clone().unwrap_or_default(),
                        "type": "function",
                        "function": {
                            "name": t.name.clone().unwrap_or_default(),
                            "arguments": t.arguments,
                        }
                    })
                })
                .collect::<Vec<_>>()
        );
        session.push(assistant);

        // Execute each tool call and feed results back.
        for t in result.tool_calls {
            let call_id = t.id.clone().unwrap_or_default();
            let args: serde_json::Value =
                serde_json::from_str(&t.arguments).unwrap_or(json!({}));
            let mut label = "Tool call".to_string();
            let outcome = match t.name.as_deref().unwrap_or("") {
                "edit_code" => {
                    label = "Editing code".to_string();
                    let code = args.get("code").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let changes = code_changes(&session.source, &code);
                    session.source = code.clone();
                    let _ = app.emit("agent-code-updated", json!({ "source": code }));
                    emit_status(&app, "editing", &label);
                    Ok(format!(
                        "Code updated ({} characters).\n{}",
                        session.source.chars().count(),
                        changes
                    ))
                }
                "run_script" => {
                    label = "Running script".to_string();
                    emit_status(&app, "running", &label);
                    match sidecar::run_script_async(&app, &session.source).await {
                        Ok(run) => {
                            let object_count = run.objects.len();
                            let run_error = run.error.clone();
                            session.last_result = Some(run);
                            let mut out = format!("Script executed. Shown objects: {object_count}.");
                            if let Some(error) = run_error {
                                out.push_str("\nError:\n");
                                out.push_str(&truncate(&error, 1500));
                            }
                            if let Some(stdout) = session
                                .last_result
                                .as_ref()
                                .map(|r| r.stdout.clone())
                                .filter(|s| !s.trim().is_empty())
                            {
                                out.push_str("\nStdout:\n");
                                out.push_str(&truncate(&stdout, 800));
                            }
                            Ok(out)
                        }
                        Err(e) => Err(e),
                    }
                }
                "get_docs" => {
                    let symbol = args.get("symbol").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    label = format!("Reading {symbol} docs");
                    emit_status(&app, "docs", &label);
                    match sidecar::get_docs_async(&app, &symbol).await {
                        Ok(docs) => {
                            Ok(format!("Documentation for {}:\n{}", docs.symbol, docs.docstring))
                        }
                        Err(e) => Err(e),
                    }
                }
                other => Err(format!("Unknown tool: {other}")),
            };

            let final_text = match outcome {
                Ok(text) => text,
                Err(e) => format!("Tool error: {e}"),
            };
            let _ = app.emit(
                "agent-tool-result",
                json!({ "label": label, "outcome": final_text }),
            );
            session.push(json!({
                "role": "tool",
                "tool_call_id": call_id,
                "content": final_text,
            }));
        }
    }

    Err("The agent exceeded the maximum number of tool iterations.".to_string())
}

pub async fn clear_chat(app: &AppHandle) {
    let state = app.state::<AgentState>();
    state.inner.lock().await.reset();
}

/// Flushes the current session's chat to its project, then loads the target
/// project into the session and returns its data.
pub async fn load_project(app: &AppHandle, id: String) -> Result<crate::project::ProjectData, String> {
    {
        let state = app.state::<AgentState>();
        let session = state.inner.lock().await;
        if let Some(pid) = session.project_id.clone() {
            if pid != id {
                let _ = crate::project::save_chat(&app, &pid, &session.history);
            }
        }
    }
    let data = crate::project::load_project_data(app, &id)?;

    let state = app.state::<AgentState>();
    let mut session = state.inner.lock().await;
    session.reset();
    session.source = data.source.clone();
    session.project_id = Some(data.id.clone());
    // Restore the conversation (skip any stored system messages; the fresh
    // system prompt is already in place from reset()).
    for message in &data.messages {
        if message.get("role").and_then(|r| r.as_str()) != Some("system") {
            session.push(message.clone());
        }
    }
    Ok(data)
}

/// Records the source in the session (when it belongs to the given project)
/// and writes it to the project's model.py.
pub async fn save_project_source(app: &AppHandle, id: String, source: String) -> Result<(), String> {
    {
        let state = app.state::<AgentState>();
        let mut session = state.inner.lock().await;
        if session.project_id.as_deref() == Some(&id) {
            session.source = source.clone();
        }
    }
    crate::project::save_source(app, &id, &source)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn msg(role: &str, content: &str) -> serde_json::Value {
        json!({ "role": role, "content": content })
    }

    fn history_chars_check(h: &[serde_json::Value]) -> usize {
        h.iter()
            .map(|m| serde_json::to_string(m).map(|s| s.len()).unwrap_or(0))
            .sum()
    }

    #[test]
    fn trims_oldest_turns_keeps_system_and_latest() {
        // Two turns: user A (+assistant) and user B (+assistant). Tiny budget
        // forces trimming of the first turn only.
        let mut history = vec![
            msg("system", "S"),
            msg("user", "AAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
            msg("assistant", "BBBBBBBBBBBBBBBBBBBBBBBBBBBB"),
            msg("user", "CCCCCCCCCCCCCCCCCCCCCCCCCCCC"),
            msg("assistant", "DDDDDDDDDDDDDDDDDDDDDDDDDDDD"),
        ];
        let budget = history_chars_check(&history[3..]);
        let dropped = trim_history(&mut history, budget);
        assert_eq!(dropped, 1);
        assert_eq!(history[0]["role"], "system");
        assert_eq!(history[1]["content"], "CCCCCCCCCCCCCCCCCCCCCCCCCCCC");
        assert_eq!(history[2]["content"], "DDDDDDDDDDDDDDDDDDDDDDDDDDDD");
        // The dropped turn (user A) is gone.
        assert!(!history.iter().any(|m| m["content"] == "AAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
    }

    #[test]
    fn tool_messages_dropped_with_their_turn() {
        let mut history = vec![
            msg("system", "S"),
            msg("user", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"),
            msg("assistant", "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"),
            msg("tool", "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"),
            msg("user", "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD"),
            msg("assistant", "EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"),
        ];
        let budget = history_chars_check(&history[4..]);
        let dropped = trim_history(&mut history, budget);
        assert_eq!(dropped, 1);
        // The tool message must not survive without its tool_calls turn.
        assert!(!history.iter().any(|m| m["role"] == "tool"));
        assert_eq!(history[1]["content"], "DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD");
    }

    #[test]
    fn single_turn_never_dropped() {
        let mut history = vec![
            msg("system", "S"),
            msg("user", "A"),
            msg("assistant", "B"),
        ];
        let dropped = trim_history(&mut history, 1); // tiny budget
        assert_eq!(dropped, 0);
        assert_eq!(history.len(), 3);
    }
}
