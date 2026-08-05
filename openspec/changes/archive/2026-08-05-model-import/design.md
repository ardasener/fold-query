## Context

The app's pipeline is mesh-driven downstream: `run_cad_script` produces `MeshObject { vertices, faces }`, and the 3D viewer, unfold, print, and mesh export all consume that shape — never the CadQuery script itself. This means an imported mesh can plug into the existing pipeline unchanged; the only design surface is how a file becomes a project. Today every project has a `model.py`; mesh imports don't map to code.

Format reality check: CadQuery's `importers` natively support STEP/BREP/DXF (as code), but NOT STL/OBJ/PLY/FBX. three.js ships loaders for OBJ/STL/PLY/glTF in the bundle already (we use its exporters today). So the hybrid splits naturally: CAD solids → code projects; triangle meshes → mesh projects.

## Goals / Non-Goals

**Goals:**
- Import button (upload icon) in the project selector; native file picker via `tauri-plugin-dialog`.
- Extension-based routing: STEP/BREP/DXF → code project (generated `model.py` + copied file, agent keeps editing); OBJ/STL/PLY/glTF → mesh project.
- Mesh projects: `mode: "mesh"` in `meta.json`, source file + normalized `mesh.json` stored, no `model.py`.
- Mesh project UI: code editor and agent chat disabled, replaced with an info box and a **scale control**.
- Scale = mesh-transform (unit conversion factor) applied before unfold; print stays 1:1 relative to the scaled model.
- Export menu gains STEP/BREP (Python-sidecar), grayed out for mesh projects.

**Non-Goals:**
- FBX import (complex binary, needs a dedicated parser) — deferred.
- Editing mesh geometry directly (no sculpting/re-meshing) — out of scope.
- Converting meshes to CadQuery solids (reverse engineering) — out of scope.
- Multiple import sources (drag-drop, folder watch) — single native picker for now.

## Decisions

### D1: `tauri-plugin-dialog` for the file picker

Official Tauri 2 dialog plugin; `open()` returns a path. One small dependency, native feel. (Alternative — HTML `<input type="file">` — rejected: blob-path resolution is awkward in Tauri and less native.)

### D2: Mesh parsing happens in the frontend via three.js loaders

`OBJLoader`/`STLLoader`/`PLYLoader`/`GLTFLoader` from `three/examples/jsm/loaders` parse the file bytes into `THREE.BufferGeometry` in the webview; we extract `position` + `index` into `MeshObject`. Zero new Rust deps, battle-tested loaders, and the result is directly consumable by the viewer/unfold/print.

**Flow:** picker → Rust `read_file` returns bytes → loader parses → convert to `MeshObject` → `invoke("import_mesh", {...})` persists.

### D3: `import_mesh` persists source + normalized mesh + meta

`import_mesh(name, source_name, source_bytes, mesh: MeshObject, scale)`:
- Creates project UUID dir.
- Writes the original file (e.g. `model.obj`), normalized `mesh.json` (vertices/faces, the `MeshObject` shape), and `meta.json` with `mode: "mesh"`, `scale` (default 1.0), name/timestamps.
- `load_project_data` for mesh projects returns `{ mode, mesh, scale }` instead of `source`.

Keeping the source file preserves provenance and allows re-import; `mesh.json` is the pipeline's canonical shape, so loading never re-parses.

### D4: `import_cad_file` for CAD solids

Copies the file into the project dir and writes `model.py`:
```python
import cadquery as cq
result = cq.importers.importStep("/abs/path/to/project/model.step")
show_object(result)
```
The generated script uses the absolute path so the runner (which executes the script in-process) finds the file regardless of CWD. The project is a normal code project — the agent can edit the script, apply operations to the imported solid, etc.

### D5: Scale is a mesh-transform applied before unfold

`meta.json` stores `scale` (unit conversion factor, e.g. 1.0 = "1 mesh unit is 1mm"). When loading a mesh project, the frontend multiplies all vertex coordinates by the scale once, producing the `MeshObject` that feeds the viewer/unfold/print. Changing the scale re-applies the transform and re-unfolds (the existing stale-result guard handles ordering). The print pipeline is untouched — it stays exact 1:1 relative to the scaled mesh. This is unit conversion, not print zoom (which we deliberately avoided in the print spec).

### D6: Mesh project UI — editor and chat disabled

The left pane's editor/chat toggle is replaced by a single read-only panel: an info box ("Imported model — cannot be edited as code; use the print settings to scale and print") and the scale control (numeric input, like the target-faces control). The top-bar Run button is hidden/disabled (no script to run). Everything on the right pane (viewer, print preview, export menu) works unchanged.

### D7: STEP/BREP export via the Python sidecar

The runner gains an export helper: `export_cad_shape(script, format)` executes the script with a shim that calls `cq.exporters.exportStep/exportBrep` instead of tessellating, writing to a requested path. The frontend calls it on demand for code projects. Mesh projects have no solid → the export menu items are `disabled` (grayed) with a tooltip explaining why.

## Risks / Trade-offs

- [glTF parse in webview for large files] → Acceptable at papercraft scale (a few MB); the bytes cross IPC once.
- [Generated STEP import script runs CadQuery import each Run] → Correct and expected; matches the code-driven paradigm.
- [Scale semantics could be confused with print zoom] → UI labels it as unit conversion ("1 unit = N mm") and the print stays 1:1; the print spec's no-zoom decision is preserved.
- [Mesh projects can't be agent-edited] → Intended; the info box explains. Future work could add agent-driven mesh ops.
- [FBX not supported] → Explicit non-goal; clear error message on unsupported extensions.

## Migration Plan

Existing projects have no `mode` in `meta.json` — treated as `mode: "code"` (default) so nothing changes. `ProjectData` gains optional `mesh`/`scale` fields; the frontend branches on mode.

## Open Questions

- None blocking. FBX, mesh editing, and mesh→solid conversion are deferred.
