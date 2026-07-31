## ADDED Requirements

### Requirement: Pane hosts switchable views
Each pane MUST be a self-contained window with a slim header showing a label and a single icon button in the top-right corner. The icon button MUST switch between the pane's two views. No traditional tab bar MUST be present.

#### Scenario: Pane header renders
- **WHEN** a pane is visible
- **THEN** it shows a slim header with a label and a single icon button at the top-right

#### Scenario: Icon switches view
- **WHEN** the user clicks a pane's switch icon
- **THEN** the pane's content toggles between its two views and the icon updates to indicate the view it switches to

### Requirement: Left pane with code editor and AI chat
The left pane MUST provide two views: a code editor and an AI chat mock. The code editor MUST be a CodeMirror 6 editor with Python syntax highlighting, pre-filled with a sample CadQuery script. The AI chat MUST be built from `@ant-design/x` components showing a mock conversation, suggestion prompts, and an input that appends a canned reply locally.

#### Scenario: Editor view with highlighting
- **WHEN** the left pane shows the editor
- **THEN** a CodeMirror editor renders containing a sample CadQuery script with Python syntax highlighting

#### Scenario: Chat view mock
- **WHEN** the left pane shows the chat
- **THEN** mock chat messages render along with suggestion prompts and a sender input

#### Scenario: Sending a chat message
- **WHEN** the user types and sends a message in the mock chat
- **THEN** the message appears as a user bubble followed by a canned assistant reply

### Requirement: Right pane with 3D viewer and print preview
The right pane MUST provide two views: a 3D model viewer and a print preview. The 3D viewer MUST render a sample 3D object with orbit controls and a grid floor using `@react-three/fiber`. The print preview MUST show a placeholder paper-sheet presentation.

#### Scenario: 3D viewer renders
- **WHEN** the right pane shows the 3D viewer
- **THEN** a three.js canvas renders a sample object, a grid floor, and supports orbiting with the mouse

#### Scenario: Print preview placeholder
- **WHEN** the right pane shows the print preview
- **THEN** a styled paper-sheet placeholder is visible
