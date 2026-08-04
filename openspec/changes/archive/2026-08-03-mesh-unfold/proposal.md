## Why

The Print Preview pane is a placeholder — the killer feature of the app (unfolding a 3D model into a printable papercraft net) does not exist yet. The unfold algorithm is designed (see DESIGN.md "Unfolding Pipeline: Algorithms") but unimplemented; the app needs the Rust pipeline and a UI that visualizes the resulting net.

## What Changes

- Add a Rust `unfold` Tauri command implementing the full unfold pipeline: half-edge adjacency → priority edge ordering → greedy island join with overlap rejection → fold classification.
- Add `glam` as a dependency for the linear algebra (Vec2/Vec3/Mat2), with `serde` for net output serialization.
- Make the Print Preview view a derived view: it auto-unfolds the latest mesh (`lastRun`) whenever visible, and re-unfolds when the mesh changes while visible.
- Render the unfolded net in the Print Preview pane as 2D SVG paths: solid cut lines, dashed valley folds, dash-dot mountain folds, and island labels.
- Add a spinner overlay to the Print Preview pane while the unfold is computing, with a stale-result guard so outdated results never render over newer meshes.
- Surface unfold failure states (non-manifold/open-boundary meshes) in the UI instead of an endless spinner.

## Capabilities

### New Capabilities
- `mesh-unfold`: The Rust unfolding pipeline — the `unfold` Tauri command, net data model (islands, fold/cut classification), overlap rejection, and fold classification.
- `net-viewer`: The Print Preview UI — derived-state auto-unfold on mesh change, 2D SVG net rendering (cut/valley/mountain line styles, island labels), spinner overlay with stale-result guard, and failure-state presentation.

### Modified Capabilities
<!-- None: the print preview currently renders a static placeholder with no spec'd behavior. -->

## Impact

- **Code**: `src-tauri/src/lib.rs` (register command), new `src-tauri/src/unfold/` module tree, `src/App.tsx` (wiring), `src/components/print/PrintPreview.tsx` (from placeholder to real renderer), new print preview CSS.
- **Dependencies**: `glam = { version = "0.33", features = ["serde"] }` in `src-tauri/Cargo.toml`.
- **Types**: new `Net` / `Island` / `FoldEdge` Rust structs (serde-serialized) and matching frontend types.
- **No changes** to the Python sidecar — the pipeline runs on the mesh that already flows through Rust.
