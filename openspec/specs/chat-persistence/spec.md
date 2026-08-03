# chat-persistence Specification

## Requirements

### Requirement: Chat state survives pane switches
Switching the left pane between the chat and the editor MUST NOT destroy the chat's messages, input text, or scroll position. The 3D viewer and print preview MUST also keep their state across right-pane switches.

#### Scenario: Chat persists across switches
- **WHEN** the user chats, switches to the editor view, and switches back
- **THEN** all prior messages, the Sender input text, and the scroll position are intact

#### Scenario: Viewer state persists
- **WHEN** the user switches the right pane away from the 3D viewer and back
- **THEN** the viewer keeps its camera position and any rendered mesh

### Requirement: No clear button
The chat MUST NOT show a clear button.

#### Scenario: No clear control
- **WHEN** the chat is displayed
- **THEN** no clear/trash control appears
