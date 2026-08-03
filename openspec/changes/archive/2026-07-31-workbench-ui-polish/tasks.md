## 1. Editor scroll

- [x] 1.1 Add `.code-editor .cm-theme { height: 100% }` to `CodeEditor.css` so the editor is height-constrained and the scroller scrolls
- [x] 1.2 Remove the `RunOutput` import/usage and `.editor-stack` output wiring from `App.tsx`; delete `RunOutput.tsx`/`RunOutput.css`

## 2. Rust event additions

- [x] 2.1 `llm.rs`: add an `on_reasoning` callback to `stream_chat`; read `delta.reasoning_content` and forward it
- [x] 2.2 `agent.rs`: emit `agent-reasoning` events with reasoning deltas; emit `agent-tool-result {label, outcome}` after each tool completes (outcome = the string fed to the model)

## 3. Chat presentation

- [x] 3.1 Rewrite `ChatPanel.tsx`: remove `Prompts`; render entries directly — user `Bubble` (placement end, user avatar, "User" header), agent `Bubble` (placement start, robot avatar, "Agent" header), `Think` blocks for thinking + tool calls (collapsed by default, per-tool icons/titles, `destroyOnHidden={false}`)
- [x] 3.2 Handle new events: `agent-reasoning` streams into the thinking Think; `agent-tool-result` fills the active tool Think; transient thinking spinner disappears when the assistant reply streams
- [x] 3.3 Auto-scroll to the latest entry via container ref + effect

## 4. Run status indicator

- [x] 4.1 `TopBar.tsx`: accept a run-status prop; render green `CheckCircleOutlined` / red `CloseCircleOutlined` (none before first run); tooltip = "Run succeeded" or the error; click copies the error (`navigator.clipboard` with fallback) and shows a toast
- [x] 4.2 `App.tsx`: pass `lastRun` to `TopBar`

## 5. Verification

- [x] 5.1 `cargo check` and `bun run build` pass
- [x] 5.2 Editor scrolls for a long script; line numbers scroll with it
- [x] 5.3 Chat: user bubbles right-aligned with user icon + "User"; agent bubbles left-aligned with robot icon + "Agent"; no prompts
- [x] 5.4 Tool calls/thinking appear as collapsed Think blocks with icons/titles; outcomes visible when expanded; reasoning content streams when available
- [x] 5.5 Top bar shows green check after a successful run and red error icon after a failed run; tooltip shows the error; click copies it
