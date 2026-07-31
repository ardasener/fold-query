## Context

DESIGN.md's architecture puts the agent in Rust ("the brain"), keeps Python thin (execution + pipeline), and plans a persistent JSON-RPC-over-stdio sidecar. This change realizes the agentic workflow: BYOK provider registration with keychain storage, the persistent sidecar, a tool-calling agent loop in Rust, and a functional chat. Exploration decisions: persistent sidecar now, CadQuery docstrings as the docs tool, API key only in the keychain, tool-activity bubbles in the chat, SSE streaming with a non-streaming fallback, and `async-openai` as the LLM client (verified: custom base URL + programmatic key injection + streamed tool calling).

## Goals / Non-Goals

**Goals:**
- Register an OpenAI-compatible provider (URL, model, key) from settings, test the connection, store the key in the OS keychain.
- Persistent sidecar: CadQuery imported once; `run_script` and `get_docs` over NDJSON stdio.
- Agent loop in Rust with tools: `edit_code`, `run_script`, `get_docs`; streamed replies; session history.
- Functional chat: streamed tokens, tool bubbles, editor/viewer sync.

**Non-Goals:**
- No multi-provider switching beyond the single BYOK config.
- No conversation persistence across app restarts (in-memory session).
- No model/viewer features beyond what the current mock supports.
- No sandboxing beyond the existing timeout/working-dir limits (still deferred per DESIGN.md).

## Decisions

### D1: `async-openai` as the LLM client
Use `async-openai` 0.41 (features `chat-completion`, `chat-completion-types`) instead of raw reqwest. Verified: `OpenAIConfig::new().with_api_base(url).with_api_key(key)` covers BYOK; `create_stream` handles SSE; tool calling (including streamed tool-call deltas) is supported. Avoids hand-rolling SSE parsing and request/response types. Caveat: OpenAI-shaped; a small adapter may be needed for exotic providers — acceptable since providers are OpenAI-compatible.

### D2: Key in the keychain, URL/model in settings
`save_provider` stores the API key in the OS keychain via the `keyring` crate (service `com.foldquery.app`, user `api_key`); URL and model go into the frontend settings store (they are not secrets). The key crosses into Rust exactly once (at save) and is never read back into the webview; `get_provider_status` returns only `{configured, url, model}`.

### D3: Provider popup with connection test
The settings modal gains an "AI Provider" section with a button that opens a popup: base URL (default `https://api.openai.com/v1`), model, API key (password input). "Test Connection" invokes `test_provider` (a minimal chat completion against the given values) and reports success/failure before saving. Save persists via `save_provider`; the key field clears afterward.

### D4: Persistent sidecar replaces single-shot
A persistent Python process (`<venv>/bin/python <cache>/sidecar.py`) is spawned once when the environment is ready and speaks NDJSON JSON-RPC over stdio: requests `{id, method, params}`, responses `{id, result|error}`. Methods: `ping`, `run_script {source}` (existing tessellation logic), `get_docs {symbol}` (import cadquery once at startup; docstrings via `inspect.getdoc`, truncated ~4k chars, "symbol not found" errors). The Run button and the agent both use the sidecar. If the process dies, it is restarted on the next call (with a single-shot fallback if spawning fails).

### D5: Agent loop in Rust
`AgentSession` (behind a `Mutex`) holds the conversation history and the current source. `chat_message {message, source}`: appends the user message, loops — call the LLM with the tools array; if the response contains `tool_calls`, dispatch each tool, append tool results, repeat; when the model returns text, stop. Bounded loop (max ~20 iterations) with a per-call timeout. A system prompt instructs the model to write valid CadQuery, use `show_object`, verify with `run_script`, and consult `get_docs` for API details.

### D6: Streaming with fallback
Requests use `stream: true`; each SSE delta is forwarded to the frontend as `agent-token`. If a provider errors on streaming, retry once without streaming (whole message emitted as a single token burst). Tool-call deltas are accumulated across stream chunks; providers that only send a final tool-call chunk also work.

### D7: Events and editor/viewer sync
`agent-status {activity}` ("thinking", "Editing code", "Running script", "Reading docs") drives tool bubbles; `agent-code-updated {source}` updates the editor on `edit_code`; `agent-done {message, result}` carries the final text and the latest `ScriptResult` so the viewer updates. The frontend mirrors the conversation for display; Rust owns the LLM history.

### D8: Tool bubbles via @ant-design/x
Tool activity renders as compact bubbles in the conversation (custom `Bubble` content with an icon + short label, e.g. "⚙ Edited code", "▶ Ran script — 2 errors", "📖 Read Workplane.box"), using the existing `Bubble.List` item shape (`role: "ai"` + custom content). No third-party chat framework; streaming is driven by our events.

### D9: Conversation state
One in-memory session per app run; `clear_chat` resets it and the frontend clears the bubble list. No persistence across restarts (future change).

## Risks / Trade-offs

- [Provider deviations from the OpenAI shape] → Streaming fallback + a thin adapter seam around `async-openai`.
- [Keychain on Linux needs a Secret Service (gnome-keyring/kwallet)] → Documented; falls back to a clear error in the provider popup.
- [Sidecar death / restart] → Restart-on-demand with single-shot fallback; agent gets a tool error it can report.
- [Agent loops (tool call cycles)] → Iteration cap (20) and per-call timeout kill the loop.
- [Streamed tool-call deltas vary by provider] → Accumulate per-chunk; treat the final message's tool_calls as authoritative when present.
- [Executing agent-written code] → Same 30s timeout + cache working dir as the current runner; full sandbox/consent still deferred (DESIGN.md).
