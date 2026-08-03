## Why

The workbench UI works but reads poorly: the editor doesn't scroll, chat messages are undifferentiated bubbles, tool activity is misrepresented as speech bubbles, suggestions clutter the chat, and the run output strip takes up editor space with a redundant header. This change polishes the workbench presentation.

## What Changes

- Fix the code editor scrolling (the CodeMirror wrapper lacks a height constraint, so the editor grows to content height and clips instead of scrolling).
- Chat presentation:
  - Remove the suggestion prompts from the chat.
  - User messages render right-aligned with a user avatar and "User" title; agent messages render left-aligned with a robot avatar and "Agent" title.
  - Thoughts and tool calls render as collapsible `Think` blocks (from `@ant-design/x`), collapsed by default, with per-tool icons and titles, instead of speech bubbles.
  - When the provider streams reasoning content, it appears inside the thinking `Think` block; otherwise the thinking block is a transient spinner.
- Replace the run output strip (with its "Run succeeded"/"Run failed" header) with a status icon in the top bar: a green check on success, a red error icon on failure whose tooltip shows the error message and whose click copies it to the clipboard.

## Capabilities

### New Capabilities
- `chat-presentation`: User/agent bubble roles (placement, avatar, title), `Think` blocks for thoughts and tool calls, and no suggestion prompts.
- `run-status`: A top-bar status icon reflecting the last run, with error tooltip and click-to-copy.
- `editor-scrolling`: The code editor scrolls within its pane instead of clipping.

### Modified Capabilities
<!-- None — no existing spec behavior changes. -->

## Impact

- Frontend: `ChatPanel.tsx` (bubble roles, Think blocks, remove Prompts, auto-scroll), `TopBar.tsx` (status icon), `App.tsx` (remove output strip wiring), removal of `RunOutput.tsx`, `CodeEditor.css` (scroll fix).
- Rust: `llm.rs` captures `reasoning_content` deltas; `agent.rs` emits `agent-tool-result` events after each tool completes.
