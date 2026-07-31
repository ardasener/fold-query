## ADDED Requirements

### Requirement: Viewer renders executed mesh
The 3D viewer MUST render the mesh returned by a script run: a three.js buffer geometry built from the vertices/faces arrays, using the active theme's colors, with orbit controls.

#### Scenario: Mesh displayed after run
- **WHEN** a run returns mesh data
- **THEN** the viewer renders the returned mesh instead of the placeholder

### Requirement: No model until first result
Until the first successful run, the viewer MUST show no 3D model (only the grid floor and lights).

#### Scenario: No result yet
- **WHEN** the app starts and no run has completed
- **THEN** the viewer shows no 3D model

#### Scenario: Failed run keeps prior view
- **WHEN** a run fails
- **THEN** the viewer keeps showing the previous mesh or nothing, and the error appears in the output strip

#### Scenario: Empty result shows no model
- **WHEN** a run succeeds but returns no objects
- **THEN** the viewer shows no 3D model
