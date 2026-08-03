## 1. Persistent sidecar

- [x] 1.1 Add `async-openai` (features `chat-completion`, `chat-completion-types`) and `keyring` to `src-tauri/Cargo.toml`
- [x] 1.2 Create `src-tauri/python/sidecar.py` (persistent, embedded): NDJSON JSON-RPC over stdio with `ping`, `run_script` (tessellation), `get_docs` (docstrings via `inspect.getdoc`, truncated); import CadQuery once at startup
- [x] 1.3 Create `src-tauri/src/sidecar.rs`: spawn the sidecar from the venv, read/write NDJSON with request ids, response timeout, restart-on-demand when the process dies, single-shot fallback
- [x] 1.4 Route the existing Run flow through the sidecar (`run_cad_script` → sidecar `run_script`)

## 2. Provider config and keychain

- [x] 2.1 Create `src-tauri/src/provider.rs`: `save_provider` (key → `keyring` service `com.foldquery.app`/`api_key`; URL/model returned to frontend), `get_provider_status` (configured/url/model, no key), `test_provider` (minimal chat completion via async-openai)
- [x] 2.2 Register commands `test_provider`, `save_provider`, `get_provider_status` in `lib.rs`

## 3. Agent loop

- [x] 3.1 Create `src-tauri/src/agent.rs`: `AgentSession` (Mutex: history + current source), system prompt (valid CadQuery, `show_object`, verify via `run_script`, consult `get_docs`), tool schemas for `edit_code`/`run_script`/`get_docs`
- [x] 3.2 Agent loop: async-openai streaming chat with tools, tool-call dispatch (edit_code → session source + `agent-code-updated`; run_script/get_docs → sidecar), iteration cap (20) and per-call timeout, streaming with non-streaming retry fallback
- [x] 3.3 Emit events: `agent-token`, `agent-status`, `agent-code-updated`, `agent-done`; register commands `chat_message`, `clear_chat`

## 4. Provider UI

- [x] 4.1 Extend the frontend `Settings` type with `provider { url, model }` (localStorage)
- [x] 4.2 Create `src/components/settings/ProviderModal.tsx`: URL (default https://api.openai.com/v1), model, key (password), Test Connection, Save; load saved URL/model; clear key field after save
- [x] 4.3 Add the AI Provider section + button to `SettingsModal`

## 5. Chat wiring

- [x] 5.1 Rewire `ChatPanel.tsx`: send via `chat_message` (with current source), append user bubble, stream `agent-token` into the assistant bubble, render tool-activity bubbles from `agent-status`, disable input while busy, clear action
- [x] 5.2 Sync editor from `agent-code-updated` and viewer from `agent-done` in `App.tsx`

## 6. Verification

- [x] 6.1 `cargo check` and `bun run build` pass
- [x] 6.2 Provider popup: test connection succeeds against opencode-go; save stores the key in the keychain; status never returns the key
- [x] 6.3 Chat: agent edits the code, runs it, and the viewer updates; tokens stream
- [x] 6.4 Tool bubbles appear with outcomes; input disabled while busy
- [x] 6.5 Sidecar survives repeated runs (single import) and restarts after a kill
