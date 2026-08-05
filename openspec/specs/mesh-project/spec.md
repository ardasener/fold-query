# mesh-project Specification

## Purpose

Support imported mesh projects: store the normalized mesh with a scale factor, disable code editing and chat, and expose a scale control that applies as a mesh transform before unfolding.

## Requirements

### Requirement: Mesh project mode
A mesh project SHALL store `mode: "mesh"` in `meta.json`, the original source file, and a normalized `mesh.json` (vertices/faces), with no `model.py`.

#### Scenario: Mesh project persists normalized mesh
- **WHEN** a mesh project is loaded
- **THEN** the normalized `mesh.json` supplies the pipeline mesh and no script is expected

#### Scenario: Source file preserved
- **WHEN** a mesh project is created
- **THEN** the original imported file is kept in the project directory

### Requirement: Editor and chat disabled for mesh projects
Mesh projects SHALL disable the code editor and agent chat, replacing them with an info box and the scale control.

#### Scenario: Editor replaced by info box
- **WHEN** a mesh project is active
- **THEN** the left pane shows an explanatory info box instead of the code editor, and the chat is not available

#### Scenario: Run button disabled
- **WHEN** a mesh project is active
- **THEN** the run control is disabled (there is no script to run)

### Requirement: Scale control
Mesh projects SHALL expose a scale control in the left pane that multiplies all vertex coordinates before the mesh enters the viewer/unfold/print pipeline.

#### Scenario: Scale applies to mesh
- **WHEN** the user changes the scale factor
- **THEN** all mesh vertices are scaled and the unfold/preview update accordingly

#### Scenario: Scale persists
- **WHEN** a mesh project with a non-default scale is closed and reopened
- **THEN** the scale is restored and applied

#### Scenario: Scale is unit conversion, not print zoom
- **WHEN** a scaled mesh is printed
- **THEN** the print remains at 1:1 relative to the scaled mesh (no additional print zoom)
