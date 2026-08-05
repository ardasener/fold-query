## ADDED Requirements

### Requirement: Import button
The project selector SHALL display an import button (upload icon) next to the "New project" button that opens a native file picker.

#### Scenario: Import button visible
- **WHEN** the project selector popover is open
- **THEN** an import button is shown beside the new-project button

#### Scenario: Native file picker opens
- **WHEN** the user clicks the import button
- **THEN** the operating system's file picker opens

### Requirement: Format routing
The import SHALL route files by extension: CAD solids (`.step`, `.stp`, `.brep`, `.dxf`) become code projects; triangle meshes (`.obj`, `.stl`, `.ply`, `.gltf`, `.glb`) become mesh projects; unsupported extensions are rejected with a clear message.

#### Scenario: STEP file imports as code project
- **WHEN** the user imports a `.step` file
- **THEN** a code project is created whose `model.py` loads the file via CadQuery and the agent retains full editing

#### Scenario: OBJ file imports as mesh project
- **WHEN** the user imports an `.obj` file
- **THEN** a mesh project is created with the parsed mesh stored as `mesh.json`

#### Scenario: Unsupported format rejected
- **WHEN** the user selects a file with an unsupported extension
- **THEN** the import is rejected with a message explaining the format is unsupported

### Requirement: Imported project created
The import SHALL create a new project that appears in the project selector, named after the imported file.

#### Scenario: Import creates selectable project
- **WHEN** an import succeeds
- **THEN** a new project appears in the selector with the file's base name and can be selected

### Requirement: CAD import generated script
A CAD-solid import SHALL write `model.py` that loads the copied source file with CadQuery's importers, using an absolute path.

#### Scenario: Generated script loads the file
- **WHEN** a CAD import project is run
- **THEN** the model loads from the copied file without manual path fixing
