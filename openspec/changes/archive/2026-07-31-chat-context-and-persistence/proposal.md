## Why

Two chat UI issues: switching the left pane from chat to editor unmounts the chat and destroys its entire state (all prior messages disappear), and the chat has a clear button that is poorly placed and unnecessary once messages are managed automatically. This change makes the chat state survive pane switches and replaces the manual clear with automatic context windowing: the LLM history is trimmed to a configurable budget, and the chat list is virtualized so rendering stays cheap even for very long conversations.

## What Changes

- Chat (and the other pane views) stay mounted across pane switches; visibility is toggled with CSS instead of unmounting, so chat messages, input text, scroll positions, the editor cursor, and the 3D camera all persist.
- The clear button is removed from the chat.
- Automatic context windowing:
  - In Rust, the agent's conversation history is trimmed when it exceeds the configured character budget by dropping the oldest complete user turns (a user message plus its following assistant/tool messages), always keeping the system prompt and the most recent turn.
  - The chat list is virtualized (`@tanstack/react-virtual`): only the visible messages render (older ones materialize on scroll-up), all messages stay in state, and a muted note marks where the LLM history was trimmed.
  - The context budget is configurable in the AI Provider settings.

## Capabilities

### New Capabilities
- `chat-persistence`: Chat state (messages, input, scroll) survives switching between the pane views.
- `context-windowing`: The agent's conversation history is trimmed to the configured budget by dropping the oldest complete user turns; the chat list is virtualized (only visible messages render); a muted note marks where the LLM history was trimmed. No manual clear needed.

### Modified Capabilities
<!-- None — no existing spec behavior changes. -->

## Impact

- New dependency: `@tanstack/react-virtual`.
- Frontend: `App.tsx` (keep both views mounted, visibility classes), `ChatPanel.tsx` (remove clear button, virtualized list, boundary note), `SettingsModal` (context budget field), CSS.
- Rust: `agent.rs` (turn-based history trimming, trim indicator event).
