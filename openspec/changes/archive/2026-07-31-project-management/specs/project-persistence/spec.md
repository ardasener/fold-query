## ADDED Requirements

### Requirement: Source auto-save
The editor source MUST be saved to the active project automatically (debounced) as the user edits, and after the agent edits the script.

#### Scenario: User edits are saved
- **WHEN** the user edits the script and pauses
- **THEN** the new source is saved to the active project's `model.py`

#### Scenario: Agent edits are saved
- **WHEN** the agent completes a turn that changed the script
- **THEN** the active project's `model.py` reflects the new source

### Requirement: Chat auto-save
The conversation history MUST be saved to the active project after each completed agent turn.

#### Scenario: Chat saved after a turn
- **WHEN** an agent turn completes
- **THEN** the active project's `chat.json` contains the conversation

### Requirement: Flush on switch
Switching projects MUST flush the pending source save and the current conversation before loading the target project.

#### Scenario: No work lost on switch
- **WHEN** the user switches projects
- **THEN** the previous project's script and chat are saved before the target is loaded
