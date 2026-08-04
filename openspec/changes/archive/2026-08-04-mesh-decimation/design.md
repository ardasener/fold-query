## Context

Curved surfaces from CadQuery tessellate to extreme triangle counts (a 20mm sphere → 8002 triangles; a cylinder → 500). The unfold algorithm handles them correctly but produces thousands of tiny islands — useless as a papercraft net. This is inherent: curved surfaces are undevelopable, and any useful net must approximate them with a bounded number of flat facets. The design decision (user): auto-detect via face count and decimate in the Rust pipeline, with the target count configurable in print settings (default 100). The 3D viewer keeps the high-res mesh; a dismissible notice explains the divergence.

## Goals / Non-Goals

**Goals:**
- `unfold` accepts a `target_faces` parameter (default 100); meshes exceeding it are decimated with MeshOptimizer QEM before unfolding.
- Fast path: meshes at/below the target are untouched — no behavior change for boxes, prisms, and typical CAD shapes.
- Response reports `simplified: { originalFaces, finalFaces } | null`.
- Global `unfoldTargetFaces` setting (default 100, clamp 30–5000) with a control in the print settings bar; changing it re-unfolds.
- Dismissible simplification notice in the print pane.
- Robustness: decimation failure falls back to the original mesh, never a broken net.

**Non-Goals:**
- Changing the 3D viewer to show the simplified mesh (user decision B).
- Agent-instruction prompting to avoid curved primitives (user decided against option 1).
- Curvature-aware detection (e.g., dihedral analysis); face-count thresholding is sufficient and predictable.
- Adaptive detail (different targets per region) — a single global target for v1.

## Decisions

### D1: `meshopt` crate for QEM decimation

Use `meshopt = "0.6.2"` (FFI bindings to MeshOptimizer, the industry-standard quadric-error-metric simplifier used by glTF/Three.js pipelines). It preserves mesh boundaries by default — important because the unfold's topology validation rejects open boundaries, and we must not introduce them.

**Alternatives:** hand-rolled QEM (avoid reimplementing a well-tested algorithm), `meshopt-rs` pure-Rust port (younger, v0.1.2), Python `pymeshlab` (violates D2bis).

### D2: `target_faces` is a parameter with a fast path

`unfold(mesh, target_faces: u32)`; inside, `if faces.len() <= target_faces { skip }`. The fast path keeps the default behavior for the overwhelming majority of shapes and makes the feature opt-in per mesh.

### D3: Decimation runs before welding, on the raw mesh

Decimate the raw tessellated mesh (duplicated vertices included) then run the existing weld → adjacency → unfold pipeline. MeshOptimizer works on non-indexed meshes; welding afterward re-establishes shared indexing.

### D4: Stats ride in the `Net` response

`Net` gains `simplified: Option<SimplifiedStats>` (`original_faces`, `final_faces`). Null when untouched. The frontend uses it to show the notice. Keeping it in the response (rather than a second round-trip) makes preview and print consistent with zero extra calls.

### D5: `unfoldTargetFaces` is a global setting with a re-unfold trigger

Add to `SettingsContext` like `paperSize` (localStorage, validated on load, default 100, clamp 30–5000). The print settings bar control calls `unfold` again with the new target — full re-unfold, covered by the existing spinner overlay. This differs from paper size (re-layout only) because simplification changes the mesh.

### D6: Graceful failure

If `meshopt_simplify` returns an error or produces an empty/degenerate mesh, fall back to the original mesh and set `simplified` to `Some` with `final_faces == original_faces` plus an error flag, so the UI can notify rather than break. The downstream validation (TooSmall, OpenBoundary, NonManifold) still runs on whatever mesh is used.

## Risks / Trade-offs

- [Decimation alters geometry; the net won't match the 3D model exactly] → Dismissible notice (D5) explains "simplified from X → Y"; viewer intentionally keeps full resolution.
- [Aggressive default (100) over-simplifies large flat surfaces (e.g. a detailed fillet)] → Configurable setting, clamped range, fast path for ≤target meshes; user can raise the target.
- [meshopt FFI build cost / C++ toolchain] → Vendored crate compiles via `cc`; standard for the ecosystem; one-time build cost.
- [Decimation introduces open boundaries on a closed mesh] → meshopt preserves boundaries (D1); the existing topology validation still guards, and failure falls back (D6).
- [Target changed rapidly (spinner churn)] → Existing stale-result guard in PrintPreview drops out-of-order unfolds.

## Migration Plan

No migration. The `unfold` command signature gains an optional parameter (default keeps current behavior when unset). Frontend starts passing the setting value.

## Open Questions

- None blocking. Adaptive/regional detail and curvature-aware detection are deferred.
