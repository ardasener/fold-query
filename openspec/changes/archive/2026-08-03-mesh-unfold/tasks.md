## 1. Rust unfold pipeline

> **Reference:** implement the algorithm exactly as described in `DESIGN.md` → "Unfolding Pipeline: Algorithms" (half-edge adjacency, priority scoring, greedy island join, flattening, overlap rejection, fold classification). That section is the authoritative description of every formula and procedure used in the tasks below; consult the reference repos under `.local/reference/` (Blender `io_export_paper_model.py`) if a pseudocode detail needs disambiguation.

- [x] 1.1 Add `glam = { version = "0.33", features = ["serde"] }` to `src-tauri/Cargo.toml`
- [x] 1.2 Create `src-tauri/src/unfold/mod.rs` with the `Net`/`Island`/`EdgeKind` DTO types (serde camelCase) and the `unfold(mesh: MeshObject) -> Result<Net, String>` public entry point
- [x] 1.3 Implement half-edge adjacency: build `HashMap<(u32,u32), Vec<HalfEdge>>` from `MeshObject`, compute twins, dihedral angles per edge, and detect open-boundary / non-manifold edges (validate and report counts)
- [x] 1.4 Implement input validation: reject empty meshes, meshes with <4 faces, and out-of-range face vertex indices with descriptive errors
- [x] 1.5 Implement priority edge ordering: score each edge with CONVEX=0.5/CONCAVE=1.0/LENGTH=-0.05 formula, sort ascending
- [x] 1.6 Implement 2D face flattening: local basis from face normal, isometric projection to 2D
- [x] 1.7 Implement union-find island tracker and the greedy join loop over priority-ordered edges
- [x] 1.8 Implement cross-edge projection: `fitting_matrix` rotation to align island B's edge onto island A's edge, with winding handling
- [x] 1.9 Implement overlap rejection: grid-hash pre-filter (cell size = bbox_diag/8), segment-intersection test, containment test
- [x] 1.10 Implement fold classification (Coplanar/Valley/Mountain from dihedral) on internal edges of each finished island
- [x] 1.11 Register the `unfold` command in `src-tauri/src/lib.rs`, running on `spawn_blocking`

## 2. Rust tests

- [x] 2.1 Unit tests: edge-length preservation on a single flattened face (tolerance 1e-6)
- [x] 2.2 Unit tests: tetrahedron unfolds to 4 triangles, box (12 tris) to 6-face cross, no overlaps (test-only polygon intersection check)
- [x] 2.3 Unit tests: open-boundary mesh (single triangle), non-manifold mesh (two faces on shared edge + third), and degenerate inputs all return structured errors
- [x] 2.4 Unit tests: concave-edge-first ordering — an L-shaped mesh cuts the concave edge, keeping convex edges folded

## 3. Frontend types & wiring

- [x] 3.1 Add `Net`, `Island`, `EdgeKind` types in `src/types/unfold.ts` matching the Rust DTO (camelCase)
- [x] 3.2 Wire Print Preview as derived state in `src/App.tsx`: pass `lastRun?.objects` and a `runId`-keyed unfold effect to `PrintPreview`
- [x] 3.3 Add stale-result guard in the Print Preview component: monotonically increasing request id, discard responses whose id ≠ latest

## 4. Net rendering UI

- [x] 4.1 Replace `PrintPreview.tsx` placeholder with SVG net renderer: white sheet, per-island `<g transform>`, cut/valley/mountain stroke styles, island labels
- [x] 4.2 Add island placement: simple grid layout (left-to-right, descending face count, gutter) in `src/lib/net-layout.ts`
- [x] 4.3 Add spinner overlay (AntD Spin) shown while an unfold is in flight, hidden on accepted result
- [x] 4.4 Add failure presentation: AntD Alert for unfold errors, placeholder caption when no mesh exists
- [x] 4.5 Add `PrintPreview.css` styles for sheet, paths, spinner overlay, and alert layout

## 5. Verification

- [x] 5.1 `cargo check` and `cargo test` in `src-tauri/` pass
- [x] 5.2 `bun run build` passes (type-check + Vite build)
- [x] 5.3 `bun tauri dev` smoke test: run sample script, switch to Print Preview, verify net renders with spinner flash, and that a broken script (open mesh) shows the error alert
