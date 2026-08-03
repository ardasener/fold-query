//! Raw OpenAI-compatible chat client.
//!
//! The agent uses this instead of async-openai's strict types so provider
//! quirks (custom SSE chunks such as cost metadata, missing fields, extra
//! fields) don't break the stream. async-openai remains for the provider
//! connection test.

use eventsource_stream::Eventsource;
use futures::StreamExt;
use reqwest::Client as ReqwestClient;
use serde_json::Value;

use crate::provider::normalize_api_base;

#[derive(Default)]
pub struct AccumulatedToolCall {
    pub id: Option<String>,
    pub name: Option<String>,
    pub arguments: String,
}

#[derive(Default)]
pub struct ChatResult {
    pub content: String,
    pub tool_calls: Vec<AccumulatedToolCall>,
}

fn chat_url(base_url: &str) -> String {
    format!("{}/chat/completions", normalize_api_base(base_url))
}

fn request_body(
    model: &str,
    messages: &[Value],
    tools: &[Value],
    stream: bool,
) -> Value {
    serde_json::json!({
        "model": model,
        "messages": messages,
        "tools": tools,
        "stream": stream,
    })
}

fn apply_tool_call_chunk(calls: &mut Vec<AccumulatedToolCall>, value: &Value, position: Option<usize>) {
    let idx = position.unwrap_or_else(|| {
        value.get("index").and_then(|i| i.as_u64()).unwrap_or(0) as usize
    });
    while calls.len() <= idx {
        calls.push(AccumulatedToolCall::default());
    }
    let slot = &mut calls[idx];
    if let Some(id) = value.get("id").and_then(|i| i.as_str()) {
        slot.id = Some(id.to_string());
    }
    if let Some(function) = value.get("function") {
        if let Some(name) = function.get("name").and_then(|n| n.as_str()) {
            slot.name = Some(name.to_string());
        }
        if let Some(arguments) = function.get("arguments").and_then(|a| a.as_str()) {
            slot.arguments.push_str(arguments);
        }
    }
}

fn extract_message(result: &mut ChatResult, message: &Value) {
    if let Some(content) = message.get("content").and_then(|c| c.as_str()) {
        result.content.push_str(content);
    }
    if let Some(calls) = message.get("tool_calls").and_then(|c| c.as_array()) {
        for (i, call) in calls.iter().enumerate() {
            apply_tool_call_chunk(&mut result.tool_calls, call, Some(i));
        }
    }
}

/// Streaming chat completion. Skips non-standard SSE chunks (cost metadata,
/// empty-choices chunks, `[DONE]`).
pub async fn stream_chat<F, G>(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[Value],
    tools: &[Value],
    mut on_delta: F,
    mut on_reasoning: G,
) -> Result<ChatResult, String>
where
    F: FnMut(&str) + Send,
    G: FnMut(&str) + Send,
{
    let client = ReqwestClient::new();
    let response = client
        .post(chat_url(base_url))
        .bearer_auth(api_key)
        .json(&request_body(model, messages, tools, true))
        .header("Accept", "text/event-stream")
        .send()
        .await
        .map_err(|e| format!("Chat request failed: {e}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!(
            "Chat request failed ({status}): {}",
            text.chars().take(400).collect::<String>()
        ));
    }

    let mut result = ChatResult::default();
    let mut stream = response.bytes_stream().eventsource();
    while let Some(event) = stream.next().await {
        let event = event.map_err(|e| format!("Stream error: {e}"))?;
        if event.data.trim() == "[DONE]" {
            break;
        }
        let Ok(value) = serde_json::from_str::<Value>(&event.data) else {
            continue; // non-JSON or unknown chunk
        };
        let Some(choices) = value.get("choices").and_then(|c| c.as_array()) else {
            continue; // metadata chunk without choices
        };
        let Some(choice) = choices.first() else {
            continue; // e.g. usage-only chunk
        };
        let Some(delta) = choice.get("delta") else {
            continue;
        };
        if let Some(text) = delta.get("content").and_then(|c| c.as_str()) {
            result.content.push_str(text);
            on_delta(text);
        }
        if let Some(reasoning) = delta.get("reasoning_content").and_then(|c| c.as_str()) {
            on_reasoning(reasoning);
        }
        if let Some(calls) = delta.get("tool_calls").and_then(|c| c.as_array()) {
            for call in calls {
                apply_tool_call_chunk(&mut result.tool_calls, call, None);
            }
        }
    }
    Ok(result)
}

/// Non-streaming chat completion (fallback for providers that reject streaming).
pub async fn chat(
    base_url: &str,
    api_key: &str,
    model: &str,
    messages: &[Value],
    tools: &[Value],
) -> Result<ChatResult, String> {
    let client = ReqwestClient::new();
    let response = client
        .post(chat_url(base_url))
        .bearer_auth(api_key)
        .json(&request_body(model, messages, tools, false))
        .send()
        .await
        .map_err(|e| format!("Chat request failed: {e}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!(
            "Chat request failed ({status}): {}",
            text.chars().take(400).collect::<String>()
        ));
    }

    let value: Value = response.json().await.map_err(|e| format!("Bad response: {e}"))?;
    let mut result = ChatResult::default();
    if let Some(message) = value
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|a| a.first())
        .and_then(|c| c.get("message"))
    {
        extract_message(&mut result, message);
    }
    Ok(result)
}
