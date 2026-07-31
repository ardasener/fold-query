## 1. Rust environment bootstrap

- [x] 1.1 Create `src-tauri/python/runner.py` (embedded runner: show_object shim, exec source from stdin, capture stdout, tessellate shown shapes to flat arrays, print JSON result)
- [x] 1.2 Create `src-tauri/src/python.rs`:
  - `find_system_python()` — resolve `python3`/`python`, parse `--version`, require >= 3.11; check `venv` and `pip` modules
  - `ensure_environment(app)` — cache dir venv check (skip when the venv python runs), else create venv → upgrade pip → install `requirements.txt` (pinned `cadquery>=2.8,<3`) → verify `import cadquery`; write `requirements.txt` + materialize `runner.py`; emit `python-setup-progress` events
  - `run_cad_script(app, source)` — spawn venv python runner with source on stdin, 30s timeout with kill, parse JSON result (blocking work via `tauri::async_runtime::spawn_blocking`)
- [x] 1.3 Register commands in `src-tauri/src/lib.rs`: `check_python_setup`, `setup_python`, `run_cad_script`, `exit_app` (via `app.exit(0)`); `cargo check` passes

## 2. Frontend modals and startup gate

- [x] 2.1 Create `src/components/python/PythonErrorModal.tsx`: non-dismissible, python.org link, per-OS install commands (brew/apt/winget), Exit button (invokes `exit_app`)
- [x] 2.2 Create `src/components/python/PythonSetupModal.tsx`: blocking modal with a spinner covering the checking phase, then a step list updated by `python-setup-progress` events during setup; error state with Retry/Exit
- [x] 2.3 Add the startup gate to `App.tsx`: on mount `check_python_setup` → `ready` | run `setup_python` with the setup modal | `missing` → error modal; render the workbench only when ready

## 3. Run flow and output

- [x] 3.1 Lift the editor source into `App` state; make `CodeEditor` controlled (value + onChange)
- [x] 3.2 Add the Run button to `TopBar.tsx` next to the settings icon (disabled while not ready/running); `onRun` callback from `App`
- [x] 3.3 Create `src/components/code-editor/RunOutput.tsx` output strip (stdout monospace + error styling + dismiss); render at the bottom of the editor pane
- [x] 3.4 Wire `App.tsx`: `run_cad_script` invoke, running state, last-run result state
- [x] 3.5 Auto-run the editor source once when the workbench becomes ready (guarded against double-run)

## 4. Viewer mesh

- [x] 4.1 Update `ViewerPanel.tsx`: accept optional mesh prop; build `BufferGeometry` (position + index + `computeVertexNormals`); render with theme colors + edges; keep the placeholder when mesh is null
- [x] 4.2 Remove the placeholder object; the viewer shows no 3D model until a mesh exists

## 5. Verification

- [x] 5.1 `cargo check` and `bun run build` pass
- [x] 5.2 `bun tauri dev` first run: setup modal shows steps and completes; workbench opens with Run enabled
- [x] 5.3 Run executes the sample script; viewer renders the chamfered box mesh; output strip shows stdout
- [x] 5.4 Second launch skips setup (venv detected)
- [x] 5.5 Script error surfaces in the output strip; timeout path kills runaway scripts
- [x] 5.6 (If a machine without Python is available) error modal shows install guidance and Exit quits the app
