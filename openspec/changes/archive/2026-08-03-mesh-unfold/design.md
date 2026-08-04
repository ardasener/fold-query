## Context

The app's two-pane workbench renders a 3D mesh (from `run_cad_script`) in the "3D View" pane; the "Print Preview" pane is a static placeholder. The mechanical pipeline (unfold → tabs → pack → export) is agreed to live in Rust (D2bis in DESIGN.md), operating on the `MeshObject { vertices, faces }` data that already flows through `ScriptResult`.

**Algorithmic reference:** DESIGN.md "Unfolding Pipeline: Algorithms" is the authoritative, accurate description of the unfold algorithm (six phases: half-edge adjacency, priority edge ordering, greedy island join, 2D flattening, overlap rejection, post-processing/fold classification). It contains the scoring function, `fitting_matrix`, segment-intersection, and containment pseudocode, and is derived from validated reference repos (`.local/reference/`). Implementers MUST treat it as the source of truth for algorithm behavior; this document covers integration decisions, not the algorithm itself.

This change implements the unfold phase and wires it into a real Print Preview UI as derived state — no new user-triggered button.

## Goals / Non-Goals

**Goals:**
- A `unfold` Tauri command: `MeshObject → Net` following the DESIGN.md "Unfolding Pipeline: Algorithms" section (phases 1–4 + fold classification; tabs and page packing deferred). The DESIGN.md pseudocode is authoritative — when in doubt, follow it.
- Print Preview becomes a derived view of the latest mesh: auto-unfold on visibility or mesh change, spinner overlay during compute, stale-result guard.
- 2D SVG rendering of the net: cut (solid), valley (dashed), mountain (dash-dot) lines; island labels; white sheet background.
- Unfold failure states surface to the user (no infinite spinner).

**Non-Goals:**
- Glue tabs / sticker generation (Phase 6 tab portion) — separate change.
- Page packing / multi-sheet layout (Phase 6 packing portion) — separate change.
- Interactive net editing (island dragging, 3D⇄net selection linking) — future.
- Non-triangle faces — input mesh is triangulated upstream (CadQuery → triangulated export).

## Decisions

### D1: `glam` for linear algebra, no petgraph, no spatial-index crate

The pipeline needs Vec2/Vec3/Mat2 math (cross/dot/normalize, `fitting_matrix`), which `glam 0.33` provides with SIMD and `serde` derive. The "graph" work is: a `HashMap<(u32,u32), Vec<HalfEdge>>` adjacency (std), a `Vec<Edge>` priority sort (`sort_by`), and a union-find island tracker (~20 lines DIY). Overlap rejection uses a hand-rolled grid hash (`HashMap<(i32,i32), Vec<usize>>`) rather than rstar/spade — 2K boundary segments at papercraft scale don't justify an R*-tree dependency.

**Alternatives:** nalgebra (heavier, more general than needed), cgmath (older, rodrigorc uses it), petgraph (its UnionFind is the only relevant piece; a dep for 20 lines), rstar/spade (overkill for the scale).

### D2: Net data model is a flat, serde-friendly graph, not nested objects

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Net {
    pub islands: Vec<Island>,          // each with a 2D position/rotation context
    pub island_count: usize,
}

pub struct Island {
    pub faces: Vec<usize>,             // source mesh face indices in this island
    pub vertices: Vec<[f64; 2]>,       // flattened 2D coordinates (shared by reference)
    pub loops: Vec<usize>,             // vertex index pairs forming boundary + internal edges
}

pub enum EdgeKind { Cut, Valley, Mountain, Coplanar }
```

The frontend needs the 2D geometry and the edge classification to draw; it does not need the 3D source topology. Islands are self-contained 2D polygons; loops are index pairs into `vertices`.

**Rationale:** keep the serialized surface minimal (frontend only draws); keep the internal Rust representation rich (half-edge handles) and project to this DTO at the command boundary.

### D3: The `unfold` command takes the mesh explicitly; frontend owns "latest mesh" semantics

```rust
#[tauri::command]
pub fn unfold(app: AppHandle, mesh: MeshObject) -> Result<Net, String>
```

The frontend already holds `lastRun.objects` (the source of truth for the viewer); it passes the selected mesh to `invoke("unfold")`. This keeps Rust stateless and matches the existing pattern (ExportButton already passes mesh data to a command). The command runs on a spawned blocking task via `tauri::async_runtime::spawn_blocking` so a large mesh never blocks the webview.

### D4: Derived-state unfold with stale-result guard

Print Preview component:
- Effect A (on visibility): when the pane becomes visible, unfold the current mesh if one exists.
- Effect B (on mesh change): when `lastRun.objects` changes and the pane is visible, re-unfold.
- Stale guard: track a monotonically increasing `runId` per unfold request; ignore any response whose `runId` ≠ latest. A `useRef` counter suffices; a plain `AbortController`-style token is unnecessary since Tauri invokes aren't cancellable — dropping stale results is the correct semantics.
- Spinner: AntD `Spin` overlay (`fullscreen` inside the pane container) shown between request and accepted response.

### D5: Failure states are first-class

The unfold returns `Err(String)` for non-manifold edges / open boundaries / degenerate input. The frontend distinguishes:
- **No mesh yet** → placeholder caption ("Run the CadQuery script to unfold").
- **Unfold error** → AntD `Alert` with the Rust error message (covers non-manifold/open-boundary cases), no spinner.

Input validation in Rust: reject empty meshes, meshes with <4 faces, faces with out-of-range vertex indices, and detect open boundaries / non-manifold edges during adjacency build (report the offending edge count).

### D6: SVG rendering via React components, not an SVG library

Net islands render as `<svg>` with `<path>` elements: each loop contributes a path with `stroke-dasharray` per `EdgeKind` (cut = none, valley = `4 3`, mountain = `1.5 3`). Per-island `<g transform="translate(x,y)">` positions islands on the sheet; a fixed viewBox fits the sheet size with padding. No d3/react-konva dependency; the geometry is simple enough for plain SVG.

### D7: Placement — islands laid out in a simple grid for now

Without page packing (non-goal), islands are placed left-to-right / top-to-bottom in descending face count, with a gutter. This is a temporary visual arrangement; the packer (future change) replaces it.

## Risks / Trade-offs

- [Greedy join can produce suboptimal (many-island) nets on pathological meshes] → Acceptable for v1; the priority ordering (CONCAVE=1.0 weight) is the primary quality lever and is inherited from the Blender reference. Interactive re-unfold is cheap (ms-scale), so a user can tweak the model and re-run.
- [Overlap rejection correctness bugs produce overlapping islands] → Unit tests with known nets (box = 6-face cross, tetrahedron, icosahedron) assert non-overlap via a test-only polygon intersection check; golden-file tests on island counts for the sample script. Re-read the DESIGN.md overlap-rejection pseudocode when writing these tests.
- [Implementer deviates from the DESIGN.md algorithm] → The algorithm section in DESIGN.md is the contract; deviations are allowed only with a documented justification and an update to DESIGN.md.
- [Non-manifold / open meshes from CadQuery export] → Detected in adjacency phase, reported as a structured error listing offending edges; UI surfaces it as an Alert.
- [Stale unfold racing a newer mesh] → `runId` guard; also the derived-state effect only triggers on changes, so re-unfolds are not spammed.
- [Large meshes (>200K faces) take seconds] → `spawn_blocking` keeps UI responsive; spinner communicates state; out of papercraft scope, no further optimization now.

## Migration Plan

No migration — new command, new UI wiring. The Print Preview pane currently renders a placeholder; this change replaces its content. Rollback is trivial (revert the change).

## Open Questions

- None blocking. Tab/packing phases are explicitly deferred to follow-up changes.
