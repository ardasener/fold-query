# model-export Specification

## Purpose

Export the current model from the 3D view to the Downloads folder in mesh formats (GLB, OBJ, STL, PLY) and CAD solid formats (STEP, BREP, gated on code projects).

## Requirements

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

### Requirement: STEP and BREP export
The export menu SHALL offer STEP and BREP options in addition to GLB, OBJ, STL, and PLY.

#### Scenario: STEP/BREP exported from solid
- **WHEN** the user selects STEP or BREP on a code project (including imported CAD solids)
- **THEN** the Python sidecar exports the model's solid via CadQuery's exporters to the Downloads folder

### Requirement: STEP/BREP unavailable for mesh projects
Mesh projects SHALL gray out the STEP and BREP export options, since a mesh has no underlying solid.

#### Scenario: Mesh project grays STEP/BREP
- **WHEN** a mesh project is active and the export menu opens
- **THEN** STEP and BREP items are disabled with an explanation
