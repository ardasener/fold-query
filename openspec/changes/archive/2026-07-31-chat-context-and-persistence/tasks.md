## 1. View persistence

- [x] 1.1 `App.tsx`: render both views of each pane permanently, wrapped in a visibility-toggling div (`.view-hidden` when inactive); apply to the left pane (editor/chat) and right pane (viewer/print)
- [x] 1.2 Add `.pane-view`/`.view-hidden` styles (`display: none`)

## 2. Context windowing (Rust)

- [x] 2.1 `agent.rs`: add a `trim_history(budget)` that drops oldest complete user turns (user message + following messages up to the next user message), keeping the system prompt and at least the most recent turn; call it after pushing messages with the configured budget
- [x] 2.2 Add `contextBudget` to the `ChatInput` payload; clamp defensively to the allowed range (4 000–200 000)
- [x] 2.3 After trimming, emit `agent-context-trimmed { droppedUserMessages }` (only when > 0)

## 3. Chat display and settings

- [x] 3.1 `ChatPanel.tsx`: remove the clear button; pass the configured budget with `chat_message`
- [x] 3.2 Add `@tanstack/react-virtual`; virtualize the message list (dynamic `measureElement`, pinned-to-bottom auto-scroll, overscan); keep all entries in state
- [x] 3.3 On `agent-context-trimmed`, place the muted "older messages trimmed" note after the Nth user entry (reposition on later trims)
- [x] 3.4 `Settings`: add `historyCharBudget` (default 30 000, clamped to 4 000–200 000 on input) and a "Context budget (chars)" numeric field in the AI Provider section

## 4. Verification

- [x] 4.1 `cargo check` and `bun run build` pass
- [x] 4.2 Chat messages, input, and scroll survive pane switches; viewer camera persists
- [x] 4.3 No clear button in the chat
- [x] 4.4 After a long conversation, the history stays under the configured budget; `agent-context-trimmed` fires; the muted boundary note appears after the trimmed turns; scrolling up renders older messages smoothly and the view stays pinned to the latest when near the bottom
