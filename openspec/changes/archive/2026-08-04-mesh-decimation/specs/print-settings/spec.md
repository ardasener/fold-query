## ADDED Requirements

### Requirement: Target face count setting
The print settings SHALL include a "target faces" control backed by a global `unfoldTargetFaces` preference with a default of 100 and a clamped range.

#### Scenario: Default value
- **WHEN** no target face count has ever been chosen
- **THEN** the effective target is 100

#### Scenario: Persisted across restarts
- **WHEN** the user changes the target face count and restarts the app
- **THEN** the chosen value is restored

#### Scenario: Out-of-range value clamped
- **WHEN** a stored or entered target falls outside the allowed range
- **THEN** the value is clamped to the range

### Requirement: Target change triggers re-unfold
Changing the target face count SHALL re-run the unfold pipeline with the new target (not merely re-lay-out), because simplification changes the mesh itself.

#### Scenario: Re-unfold on target change
- **WHEN** the user changes the target face count
- **THEN** a new unfold is requested with the updated target and the print preview reflects the new result
