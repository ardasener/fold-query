## ADDED Requirements

### Requirement: Project mode
A project SHALL carry a `mode` in its metadata: `"code"` (default, has a `model.py`) or `"mesh"` (no script; mesh stored as `mesh.json`).

#### Scenario: Existing projects default to code mode
- **WHEN** a project without a `mode` field is loaded
- **THEN** it is treated as a code project

#### Scenario: Mesh project loads mesh data
- **WHEN** a mesh project is loaded
- **THEN** the app receives its normalized mesh and scale instead of a script
