## ADDED Requirements

### Requirement: Mesh decimation before unfold
The system SHALL decimate the input mesh with quadric-error-metric simplification when its triangle count exceeds the target face count, before the unfold pipeline runs. Meshes at or below the target SHALL be unfolded unchanged (fast path).

#### Scenario: Oversized mesh simplified
- **WHEN** the input mesh has more triangles than the target face count
- **THEN** the mesh is simplified toward the target count and the unfold runs on the simplified mesh

#### Scenario: Small mesh untouched
- **WHEN** the input mesh has at most as many triangles as the target face count
- **THEN** the mesh is unfolded unchanged and no simplification occurs

### Requirement: Target face count parameter
The `unfold` command SHALL accept a `target_faces` parameter with a default of 100.

#### Scenario: Parameter defaults
- **WHEN** the command is invoked without a target face count
- **THEN** the default of 100 is used

#### Scenario: Boundary preservation
- **WHEN** a closed manifold mesh is simplified
- **THEN** the simplified mesh remains closed (no open boundaries introduced)

### Requirement: Simplification stats
The unfold response SHALL report whether simplification occurred and the face counts involved.

#### Scenario: Simplified mesh reports stats
- **WHEN** the mesh was simplified
- **THEN** the response includes the original and final triangle counts

#### Scenario: Untouched mesh reports null
- **WHEN** the mesh was not simplified
- **THEN** the response includes no simplification stats

### Requirement: Graceful decimation failure
The system SHALL fall back to the original mesh when simplification fails or produces an unusable result, and SHALL report the failure rather than returning a broken net.

#### Scenario: Decimation error falls back
- **WHEN** the simplifier errors or produces an empty/degenerate mesh
- **THEN** the original mesh is unfolded instead and the failure is reported in the response
