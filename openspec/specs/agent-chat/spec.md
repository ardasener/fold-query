# agent-chat Specification

## Requirements

### Requirement: Chat sends to the agent
The chat input MUST send the message (with the current editor source) to the agent and append the user's message to the conversation.

#### Scenario: Sending a message
- **WHEN** the user sends a chat message
- **THEN** the message appears in the conversation and the agent begins processing

### Requirement: Streamed replies
Assistant replies MUST be streamed into the conversation as tokens arrive. If the provider does not support streaming, the full reply MUST still appear.

#### Scenario: Tokens stream
- **WHEN** the agent is producing a reply
- **THEN** the assistant bubble grows with streamed tokens

#### Scenario: Non-streaming fallback
- **WHEN** the provider rejects streaming
- **THEN** the request retries without streaming and the full reply appears

### Requirement: Tool-activity bubbles
When the agent uses a tool, the conversation MUST show a compact activity bubble describing the tool (e.g., edited code, ran script, read docs), including a short outcome.

#### Scenario: Tool activity shown
- **WHEN** the agent calls a tool
- **THEN** an activity bubble appears in the conversation with the tool and its outcome

### Requirement: Editor and viewer sync
Agent code edits MUST update the editor, and the final script result MUST update the viewer.

#### Scenario: Editor updates
- **WHEN** the agent edits the code
- **THEN** the editor content updates immediately

#### Scenario: Viewer updates
- **WHEN** the agent finishes a turn that produced a script result
- **THEN** the viewer renders the resulting mesh

### Requirement: Chat busy state
While the agent is processing, the input MUST be disabled (or show a stop affordance) and further sends MUST be prevented.

#### Scenario: Input disabled while busy
- **WHEN** the agent is processing a turn
- **THEN** the send control is disabled until the turn completes
