## Why

The chat panel is a mock and the CadQuery workflow is manual (Run button). This change wires up the agentic workflow: a bring-your-own-key OpenAI-compatible provider registered in settings, a persistent Python sidecar for fast tool calls, and a real agent loop in Rust that can write CadQuery code, run it, and consult CadQuery's documentation — streamed into the chat.

## What Changes

- New **AI Provider** section in settings: a popup to enter base URL, model, and API key, with a Test Connection button. The key is stored in the OS keychain (via the `keyring` crate); URL and model persist with the other settings.
- A **persistent Python sidecar** (JSON-RPC over stdio, per DESIGN.md): imports CadQuery once at startup and answers `run_script` (script → mesh/stdout/error) and `get_docs` (symbol → docstring) requests without re-importing OCP on every call.
- A **real agent loop in Rust** (`async-openai` client): conversation history per session, tool calling over the OpenAI-compatible tools API, SSE streaming of tokens to the frontend, and three tools — `edit_code`, `run_script`, `get_docs`.
- The **chat panel becomes functional**: streamed assistant replies, compact tool-activity bubbles, editor and viewer synced via events as the agent edits and runs code.

## Capabilities

### New Capabilities
- `ai-provider`: Provider registration popup (URL/model/key), connection test, keychain storage of the key, provider status.
- `persistent-sidecar`: A long-lived Python process speaking NDJSON/JSON-RPC over stdio with `run_script` and `get_docs` methods.
- `agent-tools`: The Rust agent loop — LLM calls with tool calling, the three tools, per-session history, and code/documentation tools wired to the sidecar.
- `agent-chat`: Functional chat with streamed tokens, tool-activity bubbles, and editor/viewer synchronization.

### Modified Capabilities
<!-- None — no existing spec behavior changes. -->

## Impact

- New Rust dependencies: `async-openai` (chat-completion features), `keyring`, `reqwest` (transitively).
- New Rust modules: `agent.rs` (loop, session, tools, LLM client), `sidecar.rs` (persistent process + JSON-RPC), provider/keychain helpers; `python/sidecar.py` embedded runner.
- New commands: `test_provider`, `save_provider`, `get_provider_status`, `chat_message`, `clear_chat`; new events: `agent-token`, `agent-status`, `agent-code-updated`, `agent-done`.
- Frontend: provider popup in settings, rewired `ChatPanel`, editor/viewer sync.
- The existing single-shot `run_cad_script` path is replaced by the sidecar (the Run button and agent share it).
