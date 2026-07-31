## ADDED Requirements

### Requirement: Top bar with settings icon and project dropdown
The application MUST render a thin top bar. The bar MUST show a settings icon on the left and a project dropdown on the right. The settings icon MUST be present but non-functional. The project dropdown MUST present a list of mock projects and display the currently selected one.

#### Scenario: Top bar renders
- **WHEN** the app starts
- **THEN** a thin top bar is visible with a settings icon on the left and a project dropdown on the right

#### Scenario: Settings icon is inert
- **WHEN** the user clicks the settings icon
- **THEN** no action is taken (no panel or menu opens)

#### Scenario: Project selection
- **WHEN** the user opens the project dropdown and selects a mock project
- **THEN** the dropdown label updates to show the selected project

### Requirement: macOS overlay titlebar integration
On macOS, the top bar MUST integrate with the window titlebar: the native traffic lights float over the top bar, the window title is hidden, and the top bar is draggable. The top bar MUST provide left padding so the settings icon does not overlap the traffic lights.

#### Scenario: macOS overlay active
- **WHEN** the app runs on macOS
- **THEN** the window titlebar is in overlay style with hidden title, the traffic lights float over the top bar, and the top bar can be dragged to move the window

#### Scenario: Settings icon clears traffic lights
- **WHEN** the app runs on macOS
- **THEN** the settings icon sits to the right of the traffic lights and remains clickable

### Requirement: Draggable horizontal split
The main window MUST present a horizontal split between two panes, draggable by a divider. The default sizes MUST be approximately 40% (left) and 60% (right), with minimum sizes enforced. The split position MUST persist across app restarts.

#### Scenario: Default split
- **WHEN** the app starts with no saved layout
- **THEN** the left pane occupies approximately 40% and the right pane 60% of the width

#### Scenario: Dragging the divider
- **WHEN** the user drags the divider
- **THEN** the pane widths change smoothly and do not go below their minimums

#### Scenario: Layout persists
- **WHEN** the user adjusts the split and restarts the app
- **THEN** the adjusted split position is restored

