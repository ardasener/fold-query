## ADDED Requirements

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
