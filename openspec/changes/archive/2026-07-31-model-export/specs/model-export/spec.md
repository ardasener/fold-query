## ADDED Requirements

### Requirement: Export button with format picker
The right pane (3D view) header MUST show a download button, left of the view-switch icon. Clicking it MUST open a format picker offering GLB, OBJ, STL, and PLY.

#### Scenario: Export menu opens
- **WHEN** the user clicks the download button with a model loaded
- **THEN** a format menu with GLB, OBJ, STL, and PLY appears

#### Scenario: Hidden without a model
- **WHEN** no model is loaded
- **THEN** the download button is disabled (or hidden)

### Requirement: Export to the Downloads folder
Selecting a format MUST export the displayed mesh in that format and write it to the OS Downloads directory as `{project name}-{timestamp}.{ext}` (project name sanitized).

#### Scenario: Export written
- **WHEN** the user selects a format
- **THEN** a file named `{sanitized project name}-{YYYYMMDD-HHMMSS}.{ext}` is written to the Downloads folder

#### Scenario: Success feedback
- **WHEN** the export succeeds
- **THEN** a success toast shows the written file path

#### Scenario: Failure feedback
- **WHEN** the export fails (e.g., write error)
- **THEN** an error toast shows the reason
