# chat-presentation Specification

## Requirements

### Requirement: User and agent bubble roles
The chat MUST render user messages right-aligned with a user avatar and the title "User", and agent messages left-aligned with a robot avatar and the title "Agent".

#### Scenario: User message styling
- **WHEN** a user message is displayed
- **THEN** it is right-aligned with a user icon avatar and a "User" title

#### Scenario: Agent message styling
- **WHEN** an agent reply is displayed
- **THEN** it is left-aligned with a robot icon avatar and an "Agent" title

### Requirement: Thoughts and tool calls as Think blocks
The agent's thinking phase and tool calls MUST render as collapsible `Think` blocks rather than speech bubbles. They MUST be collapsed by default and show an appropriate icon and title for each tool.

#### Scenario: Tool call block
- **WHEN** the agent calls a tool
- **THEN** a collapsed Think block appears with the tool's label as title and a tool-specific icon

#### Scenario: Tool outcome visible
- **WHEN** the tool completes
- **THEN** the block's content shows the tool's outcome and is expandable

#### Scenario: Thinking phase
- **WHEN** the agent is reasoning
- **THEN** a Think block with a loading indicator and a "Thinking" title is shown (streaming reasoning content when the provider provides it)

### Requirement: No suggestion prompts
The chat MUST NOT show suggestion prompt chips.

#### Scenario: No prompts rendered
- **WHEN** the chat is displayed
- **THEN** no suggestion prompt chips appear
