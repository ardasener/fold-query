## ADDED Requirements

### Requirement: Simplification notice
The Print Preview SHALL display a dismissible notice when the unfolded net was produced from a simplified mesh.

#### Scenario: Notice shown after simplification
- **WHEN** the unfold response reports simplification (original face count greater than final)
- **THEN** the print pane shows a dismissible notice stating the original and final triangle counts

#### Scenario: No notice without simplification
- **WHEN** the unfold response reports no simplification
- **THEN** no simplification notice is shown

### Requirement: Viewer keeps full-resolution mesh
The 3D view SHALL continue to display the full-resolution mesh even when the net was built from a simplified mesh.

#### Scenario: 3D view unaffected by simplification
- **WHEN** the net is produced from a simplified mesh
- **THEN** the 3D viewer still shows the original, higher-detail mesh
