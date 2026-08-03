# agent-tools Specification

## Requirements

### Requirement: Agent loop with tool calling
The application MUST run an agent loop in Rust that calls the configured model with the tools API, executes requested tool calls, and continues until the model returns a text answer. The loop MUST be bounded (maximum iterations) and each LLM call MUST have a timeout.

#### Scenario: Model asks for a tool
- **WHEN** the model responds with tool calls
- **THEN** the tools execute and their results are fed back into the conversation

#### Scenario: Model answers directly
- **WHEN** the model responds with text and no tool calls
- **THEN** the loop ends and the text is delivered

#### Scenario: Runaway tool loop
- **WHEN** the model keeps requesting tools beyond the iteration cap
- **THEN** the loop stops and an error is reported

### Requirement: Edit code tool
The agent MUST be able to replace the editor source. The replacement MUST be applied to the editor and available to subsequent tools and runs.

#### Scenario: Agent edits code
- **WHEN** the agent calls `edit_code`
- **THEN** the editor updates to the new source and the agent session tracks it

### Requirement: Run script tool
The agent MUST be able to execute the current source and receive stdout, errors, and mesh results.

#### Scenario: Agent runs the script
- **WHEN** the agent calls `run_script`
- **THEN** the script executes via the sidecar and the result is returned to the agent

### Requirement: Read docs tool
The agent MUST be able to read CadQuery documentation from the installed package's docstrings for a given symbol path.

#### Scenario: Agent reads docs
- **WHEN** the agent calls `get_docs` with a symbol path
- **THEN** the docstring is returned, or a not-found error when the symbol does not exist

### Requirement: Session history
The agent MUST keep conversation history in memory per app run, including tool call and tool result messages. A clear action MUST reset it.

#### Scenario: History across turns
- **WHEN** the user sends another message after a previous turn
- **THEN** the model receives the prior conversation context

#### Scenario: Clearing the session
- **WHEN** the user clears the chat
- **THEN** the session history and the chat display are reset
