## ADDED Requirements

### Requirement: Unfold command
The system SHALL provide a Tauri command `unfold` that converts a triangulated mesh (`MeshObject` with `vertices` and `faces`) into a 2D net (`Net`) following the pipeline in DESIGN.md "Unfolding Pipeline: Algorithms": half-edge adjacency, priority edge ordering, greedy island join with overlap rejection, 2D flattening, and fold classification.

#### Scenario: Valid mesh unfolds into islands
- **WHEN** the user runs `unfold` with a valid closed, manifold triangulated mesh
- **THEN** the command returns a `Net` whose islands together contain every mesh face exactly once

#### Scenario: Command runs off the UI thread
- **WHEN** the command receives a large mesh (≥ 100K faces)
- **THEN** the computation runs on a blocking task so the webview stays responsive

#### Scenario: Islands do not overlap in 2D
- **WHEN** the command returns a `Net` for any mesh
- **THEN** no two islands' 2D polygons intersect, and no island self-intersects

#### Scenario: Fold classification is complete
- **WHEN** the command returns a `Net`
- **THEN** every edge between two faces of the same island is classified as `Coplanar`, `Valley`, or `Mountain` based on its 3D dihedral angle

### Requirement: Input validation
The system SHALL reject invalid mesh input with a structured error message before unfolding begins.

#### Scenario: Empty or degenerate mesh rejected
- **WHEN** the user passes a mesh with zero faces or fewer than 4 faces
- **THEN** the command returns an error explaining the mesh is too small to unfold

#### Scenario: Out-of-range indices rejected
- **WHEN** a face references a vertex index outside the vertices array
- **THEN** the command returns an error identifying the offending face

### Requirement: Topology validation
The system SHALL detect open boundaries and non-manifold edges during adjacency building and report them to the caller.

#### Scenario: Open boundary reported
- **WHEN** the mesh contains an edge belonging to only one face (open boundary)
- **THEN** the command returns an error naming the count of open-boundary edges and identifying them

#### Scenario: Non-manifold edge reported
- **WHEN** an edge is shared by more than two faces
- **THEN** the command returns an error naming the count of non-manifold edges and identifying them

### Requirement: Priority-weighted edge ordering
The system SHALL order dual-graph edges by cut priority using the scoring function from DESIGN.md: `CONVEX * max(dihedral,0)/π + CONCAVE * max(-dihedral,0)/π + LENGTH * (len/avg_len)` with default weights CONVEX=0.5, CONCAVE=1.0, LENGTH=-0.05.

#### Scenario: Concave edges cut first
- **WHEN** a mesh has both concave and convex edges of similar length
- **THEN** the greedy join processes convex edges first, so concave edges are more likely to be cut

### Requirement: Overlap rejection
The system SHALL reject any island join that would cause a 2D overlap, using a grid-hash pre-filter with segment-intersection and containment checks.

#### Scenario: Overlapping join rejected
- **WHEN** joining island B to island A across an edge would place B's boundary over A's boundary or interior
- **THEN** the join is rejected and the edge is marked as cut

#### Scenario: Non-overlapping join accepted
- **WHEN** joining island B to island A would not overlap any existing geometry
- **THEN** the islands merge into one

### Requirement: Isometric 2D flattening
The system SHALL flatten faces to 2D preserving edge lengths and interior angles (isometric mapping).

#### Scenario: Edge lengths preserved
- **WHEN** any face is flattened to 2D
- **THEN** every flattened edge length equals its 3D length within floating-point tolerance (1e-6)
