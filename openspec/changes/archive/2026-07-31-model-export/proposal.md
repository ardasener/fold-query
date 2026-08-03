## Why

Users need to take their generated 3D models out of FoldQuery. This change adds a mesh export feature: a download button in the right pane header opens a format picker, and the currently displayed model is written to the OS Downloads folder as `{project name}-{timestamp}.{ext}`.

## What Changes

- A download button appears in the right pane header, left of the view-switch icon (visible in the 3D view).
- Clicking it opens a format dropdown: **GLB, OBJ, STL, PLY** (GLB only for glTF — the text form needs a companion .bin; FBX has no reliable exporter).
- Selecting a format exports the currently displayed mesh via the matching three.js exporter and writes the file to the OS Downloads directory (resolved via Tauri's `download_dir`).
- The file is named `{sanitized project name}-{YYYYMMDD-HHMMSS}.{ext}`; a success/error toast confirms the result.
- Export is hidden/disabled when no model is loaded.

## Capabilities

### New Capabilities
- `model-export`: Export the displayed mesh as GLB/OBJ/STL/PLY to the Downloads folder with a timestamped project-based filename.

### Modified Capabilities
<!-- None — no existing spec behavior changes. -->

## Impact

- Rust: new `download.rs` helper + `write_downloads_file` command (writes bytes to `app.path().download_dir()`).
- Frontend: new `ExportMenu`/`ExportButton` component in the right pane header (needs a `Pane` header `extra` slot), export logic using three.js exporters, wiring in `App.tsx` and `ViewerPanel`-adjacent code.
