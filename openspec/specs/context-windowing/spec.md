# context-windowing Specification

## Requirements

### Requirement: LLM history is bounded
The agent's conversation history MUST NOT grow unboundedly. When the history exceeds the configured character budget, the oldest complete user turns (a user message and its following assistant/tool messages) MUST be dropped, always keeping the system prompt and the most recent turn.

#### Scenario: History trimmed
- **WHEN** the history exceeds the character budget
- **THEN** the oldest complete user turns are dropped until the history fits, with the system prompt and most recent turn retained

#### Scenario: Tool ordering preserved
- **WHEN** trimming drops messages
- **THEN** tool results are never dropped without their corresponding tool-call messages

### Requirement: Configurable context budget
The character budget used for trimming the LLM history MUST be configurable in the AI Provider settings, with a sensible default. The configured value MUST be applied to subsequent chat turns.

#### Scenario: Budget configured
- **WHEN** the user sets a context budget in the AI Provider settings
- **THEN** subsequent chat turns trim the history at the configured size

#### Scenario: Invalid budget rejected
- **WHEN** the user enters a budget outside the allowed range
- **THEN** the value is clamped to the allowed range

### Requirement: Virtualized chat rendering
The chat MUST render only the visible portion of the conversation, materializing older entries when the user scrolls up. All messages remain in state (none are dropped from the conversation), and while the user is near the bottom, new messages auto-scroll into view.

#### Scenario: Scrolling up loads older messages
- **WHEN** the conversation is long and the user scrolls up
- **THEN** older messages render as they enter the viewport

#### Scenario: Pinned to the latest
- **WHEN** new messages arrive while the user is near the bottom
- **THEN** the view auto-scrolls to the latest message

### Requirement: Context boundary note
The chat MUST show a muted note marking where the LLM history was trimmed, so the user knows which older messages the model no longer remembers.

#### Scenario: Boundary shown
- **WHEN** the LLM history has been trimmed
- **THEN** a muted note appears at the point where the trimmed messages end
