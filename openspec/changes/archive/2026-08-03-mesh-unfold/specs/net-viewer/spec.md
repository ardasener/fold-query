## ADDED Requirements

### Requirement: Derived net view
The Print Preview pane SHALL be a derived view: it unfolds the latest mesh (`lastRun.objects`) automatically when the pane becomes visible, and re-unfolds when the mesh changes while the pane is visible. The user SHALL NOT need to press a separate "unfold" button.

#### Scenario: Pane becomes visible with a mesh available
- **WHEN** the user switches the right pane from "3D View" to "Print Preview" and a mesh exists from the last run
- **THEN** the pane requests an unfold of that mesh

#### Scenario: Pane becomes visible without a mesh
- **WHEN** the user switches to "Print Preview" but no mesh has been produced yet
- **THEN** the pane shows a placeholder caption prompting the user to run the CadQuery script

#### Scenario: Mesh changes while visible
- **WHEN** a new mesh arrives (run button or agent tool) while the Print Preview pane is visible
- **THEN** the pane re-unfolds the new mesh automatically

#### Scenario: Unchanged mesh does not re-unfold
- **WHEN** the mesh is identical to the one already unfolded and the pane remains visible
- **THEN** no new unfold request is issued

### Requirement: Spinner overlay
The Print Preview pane SHALL show a spinner overlay while an unfold request is in flight.

#### Scenario: Spinner shown during unfold
- **WHEN** an unfold request has been issued but no result has been accepted
- **THEN** the pane displays a spinner overlay over the net area

#### Scenario: Spinner hidden on completion
- **WHEN** the unfold result is accepted (success or error)
- **THEN** the spinner is removed

### Requirement: Stale-result guard
The system SHALL discard unfold results that do not correspond to the most recent mesh.

#### Scenario: Outdated result discarded
- **WHEN** a second unfold is issued before the first completes (e.g., mesh changed during unfold)
- **THEN** the first result is ignored and only the second result renders

### Requirement: Net rendering
The Print Preview pane SHALL render the unfolded net as 2D SVG paths on a white sheet: solid lines for cut edges, dashed lines for valley folds, dash-dot lines for mountain folds, and a text label per island.

#### Scenario: Cut edges drawn solid
- **WHEN** the net is rendered
- **THEN** every `Cut` edge appears as a solid SVG path

#### Scenario: Folds drawn with distinct dashes
- **WHEN** the net is rendered
- **THEN** `Valley` edges appear dashed and `Mountain` edges appear dash-dot

#### Scenario: Islands labeled
- **WHEN** the net has more than one island
- **THEN** each island carries a visible label

### Requirement: Unfold failure presentation
The Print Preview pane SHALL surface unfold failures to the user instead of showing a spinner indefinitely.

#### Scenario: Unfold error shown as alert
- **WHEN** the unfold command returns an error (e.g., open boundary, non-manifold edges, degenerate mesh)
- **THEN** the pane displays an alert with the error message and hides the spinner

#### Scenario: Invalid geometry offers guidance
- **WHEN** the error indicates invalid topology (open boundary or non-manifold edges)
- **THEN** the alert explains the likely cause (open/non-manifold mesh) and that the CadQuery script may need fixing
