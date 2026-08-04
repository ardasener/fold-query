## 1. Rust simplification

- [x] 1.1 Add `meshopt = "0.6.2"` to `src-tauri/Cargo.toml` and verify it builds (`cargo check`)
- [x] 1.2 Add `target_faces: u32` parameter to the `unfold` command and `unfold()` entry point (default 100)
- [x] 1.3 Implement the fast path: skip simplification when `faces.len() <= target_faces`
- [x] 1.4 Implement `simplify_mesh(vertices, faces, target_faces) -> Result<(Vec<f64>, Vec<u32>, u32), String>`: run `meshopt_simplify` on the raw mesh toward the target triangle count, returning the final face count
- [x] 1.5 Add `SimplifiedStats { original_faces, final_faces }` and `simplified: Option<SimplifiedStats>` to the `Net` DTO (serde camelCase)
- [x] 1.6 Implement graceful failure: on simplifier error or empty/degenerate output, fall back to the original mesh and set `simplified` with an error flag

## 2. Rust tests

- [x] 2.1 Unit test: a mesh at/below the target is unfolded unchanged (no simplification, `simplified == None`)
- [x] 2.2 Unit test: a sphere-like dense mesh (e.g. UV sphere generated as triangles, ~1000+ faces) is reduced toward the target (final faces ≤ target, `simplified` populated)
- [x] 2.3 Unit test: simplified mesh remains a valid closed manifold (no open-boundary/non-manifold errors downstream)
- [x] 2.4 Unit test: `target_faces` default of 100 applies when not specified
- [x] 2.5 Regression: existing tetrahedron/cube/soup-cube unfold tests still pass unchanged

## 3. Settings & wiring

- [x] 3.1 Add `unfoldTargetFaces: number` to `SettingsContext` (default 100, clamp 30–5000, load validation, localStorage persistence)
- [x] 3.2 Add a numeric "Target faces" control to the print settings bar in `PrintPreview.tsx`
- [x] 3.3 Pass `targetFaces` to `invoke("unfold", { mesh, targetFaces })` and re-unfold on change (stale-result guard already covers ordering)

## 4. Notice & types

- [x] 4.1 Extend `Net` types in `src/types/unfold.ts` with `simplified: { originalFaces, finalFaces } | null`
- [x] 4.2 Add a dismissible AntD Alert in the print pane when `net.simplified` is present: "Mesh simplified from X → Y triangles for unfolding"
- [x] 4.3 Add CSS for the notice (reuse existing alert styles)

## 5. Verification

- [x] 5.1 `cargo check` and `cargo test` in `src-tauri/` pass
- [x] 5.2 `bun run build` passes
- [x] 5.3 Smoke test: run a sphere model, verify the notice appears, the net is usable (few islands), changing the target re-unfolds, and the 3D view still shows the dense mesh
