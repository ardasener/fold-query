## Context

The workbench left pane conditionally renders the editor or the chat (`{leftIsEditor ? <CodeEditor/> : <ChatPanel/>}`), so switching views unmounts the chat and destroys its local state. The chat also has a clear button the user dislikes. Exploration decisions: keep both views mounted and toggle visibility with CSS (preserves all state with no lifting); remove the clear button; add turn-based automatic trimming of the LLM history (Rust) and virtualized rendering of the chat list (frontend).

## Goals / Non-Goals

**Goals:**
- Chat messages, input text, and scroll position survive pane switches.
- The 3D viewer (and print preview) also keep state across switches.
- Remove the chat clear button.
- Bound the LLM history to a configurable budget by dropping the oldest complete user turns.
- Virtualize the chat list so rendering stays cheap for long conversations, with a muted note where the LLM history was trimmed.

**Non-Goals:**
- No summarization of old messages (an LLM call per turn — deferred; the model can infer from the injected current script + recent turns).
- No persistence of the conversation across app restarts (still in-memory).

## Decisions

### D1: Keep views mounted, toggle visibility
Each pane renders both of its views permanently, with a wrapper div hidden via `display: none` when inactive (`.view-hidden`). Rationale: React unmounting is what destroys ChatPanel's local state; mounting both preserves entries, Sender input, scroll positions, the editor cursor, and the three.js camera. Cost: both views stay in memory — acceptable for a desktop app. The hidden three.js canvas keeps running its render loop; R3F's ResizeObserver recovers when the pane is shown again (verified pattern in the viewer already).

### D2: Remove the clear button
The chat footer's clear button is deleted; the Sender is the only control. The automatic history trimming (D3) bounds the LLM context, so a manual clear is unnecessary.

### D3: Turn-based history trimming (Rust)
`AgentSession` gains a character budget for the history. The budget is **configurable** via the AI Provider settings (a "Context budget" numeric field, default ~30 000 chars ≈ 8k tokens, range 4 000–200 000; the setting is clamped on input, and Rust clamps defensively too); the frontend passes it with each `chat_message` call (like url/model). Note: the OpenAI-compatible API does not expose an input-context budget — context length is model-specific and not reported by `/models` — so this is a client-side, character-based approximation of tokens. After pushing a message, if the history exceeds the budget, drop whole user turns from the front: a user message plus every message after it up to (not including) the next user message. Always keep the system prompt and at least the most recent turn (never trim a turn that alone exceeds the budget). Rationale: the OpenAI-compatible API requires tool results to immediately follow their tool_calls messages, so messages cannot be trimmed individually — the user turn is the atomic unit. When trimming drops N user messages, Rust emits `agent-context-trimmed { droppedUserMessages: N }` so the frontend can place the boundary note (D4).

### D4: Virtualized chat rendering (instead of display trimming)
The chat list renders with `@tanstack/react-virtual`: only the visible entries (plus a small overscan) exist in the DOM, and older entries materialize automatically when the user scrolls up — no manual paging and no display trimming. All entries stay in React state (small strings/objects; even a huge 1M-token conversation is only a few MB), so nothing is lost from view. Dynamic item heights (streaming bubbles, Think blocks, code) use `measureElement`. While the user is pinned near the bottom, new entries auto-scroll to the latest; scrolling up pins the viewport. A muted note marks the LLM-context boundary: on the `agent-context-trimmed` event, the frontend counts the first `droppedUserMessages` user entries and inserts the note after the last of them (each displayed user entry corresponds to one history user message, so the mapping is exact). The note is repositioned on later trims.

## Risks / Trade-offs

- [Both views always mounted] → Slightly more memory; hidden canvas keeps rendering. Acceptable for a desktop app; can pause the R3F frameloop when hidden later if it matters.
- [Virtualized list adds complexity] → `@tanstack/react-virtual` is headless and standard; dynamic measurement via `measureElement` handles variable heights. Streaming growth requires re-measurement, which the library observes.
- [The LLM budget and the visible conversation can drift] → Intended: the user can scroll back through everything said, while a muted note marks where the model's memory begins. The injected current script plus recent turns keep the model coherent.
- [A single very long turn exceeds the budget] → It is kept whole rather than split, so a verbose turn stays until the next trim.
- [Hidden three.js canvas keeps running] → Accepted for now.
