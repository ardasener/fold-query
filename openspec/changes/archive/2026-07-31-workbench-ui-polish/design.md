## Context

The agentic workflow is functional; this change improves how the workbench presents itself. Root causes identified during exploration: the CodeMirror wrapper div (`cm-theme`) has no height so `cm-editor { height: 100% }` resolves to auto (editor grows to content and clips); `@ant-design/x` exports a `Think` component (collapsed by default via `defaultExpanded`, with `title`/`icon`/`loading`) suited for thoughts and tool calls; `Bubble` supports `placement`, `avatar`, and `header` for role differentiation.

## Goals / Non-Goals

**Goals:**
- Editor scrolls within its pane.
- Chat: right-aligned user bubbles with user avatar + "User" title; left-aligned agent bubbles with robot avatar + "Agent" title; no suggestion prompts.
- Thoughts and tool calls as collapsible `Think` blocks with icons/titles, collapsed by default.
- Run status as a top-bar icon (green check / red error) with error tooltip and click-to-copy, replacing the output strip.

**Non-Goals:**
- No changes to agent behavior beyond the two event additions (reasoning content capture, tool-result events).
- No new chat features (stop button, editing, etc.).
- No changes to the run execution flow itself.

## Decisions

### D1: Editor scroll fix
Add `.code-editor .cm-theme { height: 100% }` so the `height: 100%` set on `.cm-editor` resolves against a constrained parent; the `.cm-scroller` then scrolls internally (its default `overflow: auto`). The editor stack simplifies once the output strip is removed.

### D2: Render bubbles directly, not via Bubble.List
`ChatPanel` renders each entry as a `Bubble` component (or `Think` for thoughts/tools) in the scroll container, because tool/thought blocks are not speech bubbles and must interleave with them. User bubbles: `placement="end"`, `<Avatar icon={<UserOutlined/>}/>`, `header="User"`. Agent bubbles: `placement="start"`, `<Avatar icon={<RobotOutlined/>}/>`, `header="Agent"`. Auto-scroll to the latest entry via a container ref + effect (Bubble.List's auto-scroll is no longer used).

### D3: Think blocks for thoughts and tools
- On the `agent-status` "thinking" event, append a `Think` with title "Thinking…" and `loading`.
- On a tool `agent-status` event, finalize the active loading Think and append a new `Think` (title = tool label, tool-specific icon — `CodeOutlined` for edit_code, `PlayCircleOutlined` for run_script, `ReadOutlined` for get_docs — and `loading` while it runs).
- On the new `agent-tool-result` event, fill the last loading Think with the outcome (`loading` off).
- All `Think` blocks use `defaultExpanded` (collapsed by default) and `destroyOnHidden={false}` so content persists when collapsed.
- Reasoning content (when the provider streams it as `reasoning_content`) streams into the thinking Think; if absent, the thinking Think is a transient spinner that disappears when the assistant reply streams.

### D4: Reasoning content + tool-result events (Rust)
`llm.rs` `stream_chat` gains an `on_reasoning` callback and reads `delta.reasoning_content` (DeepSeek-style) alongside `content`. `agent.rs` emits `agent-tool-result {label, outcome}` after each tool completes (outcome = the same string fed back to the model), and forwards reasoning deltas as `agent-reasoning` events.

### D5: Remove suggestion prompts
The `Prompts` block is removed from the chat footer; the Sender remains the only input.

### D6: Top-bar run status replaces the output strip
The `RunOutput` strip is deleted. `TopBar` receives the last run result and renders: nothing before the first run; a green `CheckCircleOutlined` with tooltip "Run succeeded" on success; a red `CloseCircleOutlined` with the error message as tooltip on failure. Clicking an error icon copies the error message via `navigator.clipboard` (with an `execCommand` fallback) and shows an AntD message toast. App passes `lastRun` to `TopBar`; the agent-done path already updates `lastRun`.

## Risks / Trade-offs

- [Reasoning content field varies by provider] → `reasoning_content` is read leniently; absence degrades to a transient spinner.
- [navigator.clipboard permission in the webview] → Called within a user gesture (click); `execCommand` fallback covers older behavior.
- [Manual bubble rendering loses Bubble.List conveniences] → Auto-scroll is reimplemented with a ref/effect; trivial for the entry count here.
- [Tool-result event timing vs UI] → Tools run sequentially, so "the last loading Think" reliably identifies the active tool.
