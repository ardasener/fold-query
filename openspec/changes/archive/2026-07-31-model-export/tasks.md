## 1. Rust download helper

- [x] 1.1 Create `src-tauri/src/download.rs`: `downloads_dir(app)` via `app.path().download_dir()`, `write_downloads_file(fileName, data: Vec<u8>) -> String` (writes the file, returns the path)
- [x] 1.2 Register the `write_downloads_file` command in `lib.rs`; `cargo check` passes

## 2. Pane extra slot

- [x] 2.1 `Pane.tsx`: add an optional `extra?: ReactNode` header slot rendered before the switch icon; update CSS if needed

## 3. Frontend export

- [x] 3.1 Create `src/components/viewer/ExportButton.tsx`: a `Dropdown` with GLB/OBJ/STL/PLY items, disabled without a model; on select, build a THREE.Group from the mesh objects, run the matching exporter (GLTFExporter binary / OBJExporter / STLExporter / PLYExporter), convert to `Uint8Array`, and `invoke("write_downloads_file", { fileName, data })`
- [x] 3.2 Filename helper: sanitize the project name, append `-{YYYYMMDD-HHMMSS}.{ext}`
- [x] 3.3 Show success/error toasts with the returned path
- [x] 3.4 Wire the export button into the right pane header (`Pane` `extra`) in `App.tsx`, visible only in the viewer view

## 4. Verification

- [x] 4.1 `cargo check` and `bun run build` pass
- [x] 4.2 With a model loaded, each format writes `{project}-{timestamp}.{ext}` to the Downloads folder
- [x] 4.3 Exported GLB/OBJ/STL/PLY open correctly in another tool
- [x] 4.4 The button is disabled/hidden without a model; toasts appear on success and failure
