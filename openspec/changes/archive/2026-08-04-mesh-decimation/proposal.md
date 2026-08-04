## Why

Curved, undevelopable surfaces (spheres, cylinders, tori) tessellate into thousands of tiny triangles (a 20mm-radius sphere → 8002 triangles at tolerance 0.1). The unfold algorithm correctly processes every one of them but produces thousands of tiny islands — a useless papercraft net. A 42-face icosphere, by contrast, unfolds into a manageable net. The fix is to cap mesh complexity before unfolding via automatic mesh decimation, with the target count configurable in the print settings.

## What Changes

- Add a `target_faces` parameter to the `unfold` Tauri command (default 100). When the input mesh exceeds the target, decimate it with quadric-error-metric simplification (MeshOptimizer's `meshopt_simplify`) before the unfold pipeline runs.
- Meshes at or below the target are untouched (fast path) — boxes, prisms, and most CAD shapes are unaffected.
- The unfold response carries simplification stats (`simplified: { originalFaces, finalFaces } | null`) so the UI can report what happened.
- Add a global `unfoldTargetFaces` setting (default 100, clamped range) surfaced as a numeric control in the print settings bar next to paper size. Changing it triggers a full re-unfold with the new target.
- The print pane shows a dismissible notice when the mesh was simplified ("Mesh simplified from 8000 → 100 triangles"), explaining why the net looks coarser than the 3D view.
- The 3D viewer keeps showing the full-resolution mesh (unchanged).

## Capabilities

### New Capabilities
- `mesh-simplification`: Rust-side mesh decimation in the unfold pipeline — target-face-count parameter, QEM simplification via `meshopt`, fast path for small meshes, simplification stats in the response, and graceful fallback to the original mesh on decimation failure.

### Modified Capabilities
- `print-settings`: The settings bar gains a "target faces" control (global preference, default 100); changing it re-runs the unfold rather than re-laying out.
- `print-output`: The print document and net flow now consume simplified meshes when decimation applies, and surface a dismissible simplification notice.

## Impact

- **Code**: `src-tauri/src/unfold/` (new `simplify` step + `target_faces` param + stats in `Net`), `src-tauri/src/lib.rs` (command signature), `src/settings/SettingsContext.tsx` (`unfoldTargetFaces`), `src/components/print/PrintPreview.tsx` (control + notice), `src/types/unfold.ts` (response type).
- **Dependencies**: `meshopt = "0.6.2"` in `src-tauri/Cargo.toml` (vendored C++ compiled at build time).
- **No Python changes** — decimation runs in Rust per D2bis.
