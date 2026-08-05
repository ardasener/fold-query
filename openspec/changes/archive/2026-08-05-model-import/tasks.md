## 1. Import backend (Rust)

- [x] 1.1 Add `tauri-plugin-dialog` to `src-tauri/Cargo.toml` and the JS side (`@tauri-apps/plugin-dialog`), register the plugin in `lib.rs`
- [x] 1.2 Add `read_file(path) -> Vec<u8>` command (read bytes for three.js loaders)
- [x] 1.3 Add `import_mesh(name, source_name, source_bytes, mesh: MeshObject, scale)` command: create project UUID dir, write source file + `mesh.json` (normalized vertices/faces) + `meta.json` with `mode: "mesh"` and `scale`
- [x] 1.4 Add `import_cad_file(name, source_name, source_bytes)` command: copy file into project dir, generate `model.py` with `cq.importers.importStep("<abs path>")` (extension-aware: STEP/BREP/DXF), write `meta.json` with `mode: "code"`
- [x] 1.5 Extend `load_project_data` for mesh projects: return `{ mode, mesh, scale }` instead of a script; treat missing `mode` as `"code"`
- [x] 1.6 Register all new commands in `lib.rs` invoke handler

## 2. Import frontend

- [x] 2.1 Add `@tauri-apps/plugin-dialog` JS package
- [x] 2.2 Add import button (upload icon) to `ProjectSelector.tsx` next to the new-project button, wired to `open()` from the dialog plugin
- [x] 2.3 Implement format routing: extension → `import_mesh` or `import_cad_file`; reject unsupported extensions with a message
- [x] 2.4 Implement mesh parsing: read file bytes via `read_file`, parse with `OBJLoader`/`STLLoader`/`PLYLoader`/`GLTFLoader` (three.js), extract `position`/`index` into `MeshObject`, invoke `import_mesh`
- [x] 2.5 Auto-name the new project from the file's base name; refresh the project list and activate the new project
- [x] 2.6 Unit-test the format router (extension → mode mapping, unsupported rejection)

## 3. Mesh project mode

- [x] 3.1 Extend `ProjectData` type (frontend) with `mode`, optional `mesh`, `scale`
- [x] 3.2 When a mesh project is active, disable the code editor and agent chat in the left pane; show an info box ("Imported model — cannot be edited as code")
- [x] 3.3 Add the scale control to the mesh project's left pane (numeric input, "1 unit = N mm" label)
- [x] 3.4 Apply scale: multiply all mesh vertex coordinates by `scale` once on load; re-unfold on scale change (stale-result guard already exists)
- [x] 3.5 Disable/hide the Run button for mesh projects
- [x] 3.6 Update CSS for the info box and scale control

## 4. Export additions

- [x] 4.1 Add `export_cad_shape` to the Python runner: execute the script with an export shim calling `cq.exporters.exportStep`/`exportBrep` to a target path
- [x] 4.2 Add a Rust command `export_cad(project_id, format) -> path` that runs the script with the export shim and writes to the Downloads folder (reuse `write_downloads_file` path logic)
- [x] 4.3 Add STEP and BREP items to `ExportButton.tsx` (dropdown), invoking `export_cad`; gray them out (`disabled` + tooltip) when the active project is a mesh project

## 5. Verification

- [x] 5.1 `cargo check` and `cargo test` in `src-tauri/` pass
- [x] 5.2 `bun run build` passes
- [x] 5.3 Smoke test: import an OBJ → mesh project created, editor/chat disabled, scale control works, unfold/print pipeline runs on the scaled mesh; import a STEP → code project whose Run loads the solid; export STEP from a code project and confirm it is grayed for mesh projects
