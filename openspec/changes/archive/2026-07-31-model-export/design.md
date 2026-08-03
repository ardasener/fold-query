## Context

The app generates CadQuery models and displays their tessellated meshes. Users need to export them. Exploration decisions: export the displayed mesh (already in `lastRun.objects`) via three.js exporters — no Python re-run; formats GLB/OBJ/STL/PLY (FBX skipped: proprietary, no maintained exporter; text GLTF skipped: needs a companion `.bin`); write to the OS Downloads directory via Tauri's built-in `download_dir()`; filename `{sanitized project}-{timestamp}.{ext}`.

## Goals / Non-Goals

**Goals:**
- Export the displayed model as GLB, OBJ, STL, or PLY.
- Write to the OS Downloads folder with a timestamped, project-based filename.
- A download button in the right pane header (left of the switch icon) with a format dropdown.
- Success/error feedback via toast.

**Non-Goals:**
- No CAD-accurate (B-rep) formats (STEP/3MF/AMF/SVG) — those require a CadQuery-side pipeline re-running the script; deferred.
- No FBX (no reliable open-source exporter) or text GLTF (companion `.bin`).
- No export from the print preview (viewer only).
- No progress reporting for large exports.

## Decisions

### D1: Export the displayed mesh
The export builds a THREE.Group of meshes from `lastRun.objects` (the same geometry the viewer renders) and runs the chosen three.js exporter. No Python involvement. The exported surface is the tessellation, not the exact CAD B-rep.

### D2: Formats and exporters
- **GLB**: `GLTFExporter` with `binary: true` (single-file glTF).
- **OBJ**: `OBJExporter` (text).
- **STL**: `STLExporter` (binary).
- **PLY**: `PLYExporter` (binary).
All come from `three/examples/jsm/exporters/`. No FBX/text-GLTF per the exploration decision.

### D3: Downloads directory
`app.path().download_dir()` resolves the OS Downloads directory (`~/Downloads` on macOS/Linux, `%USERPROFILE%\Downloads` on Windows). No extra dependency.

### D4: Filename
`{sanitized project name}-{YYYYMMDD-HHMMSS}.{ext}`. The project name is sanitized (characters outside `[A-Za-z0-9_-]` → `-`); the timestamp prevents collisions. If a same-name file already exists, it is overwritten.

### D5: Button placement
The right pane header gains an `extra` slot in `Pane` (rendered before the switch icon). The download button lives there, shown only in the 3D view, and disabled when no model is loaded.

### D6: Data transfer
The exporter output (ArrayBuffer or string) is sent to Rust as a `Uint8Array` via `write_downloads_file { fileName, data }`; Rust writes it to the Downloads directory and returns the final path. The frontend shows a success toast (with the path) or an error toast.

## Risks / Trade-offs

- [Mesh export is a tessellation approximation] → Expected for mesh formats; CAD-accurate formats are a deferred sidecar pipeline.
- [Large exports over IPC] → Current models are small (tens of KB); fine for now, revisit streaming for huge meshes.
- [Overwrite on timestamp collision] → Extremely unlikely with second-resolution timestamps; accepted.
