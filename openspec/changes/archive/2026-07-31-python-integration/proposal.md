## Why

The workbench mock renders a dummy icosahedron and the code editor is inert. The app's core value depends on CadQuery, which requires a working Python environment. This change wires up the first real Python integration: bootstrapping a managed environment (venv in the OS cache directory with CadQuery installed), running the editor's CadQuery script, and rendering the resulting geometry in the 3D viewer.

## What Changes

- On startup, Rust checks for a usable Python 3 (>= 3.11) with `venv` and `pip`. If Python is missing or incomplete, the app shows a non-dismissible error modal with a link to python.org, per-OS install commands (Homebrew, apt, winget, etc.), and an Exit button.
- If Python is present, Rust bootstraps a venv at the OS cache directory (e.g. `~/Library/Caches/com.foldquery.app/venv`), installs pinned dependencies (`cadquery>=2.8,<3`) via `pip`, and verifies the import. A blocking progress modal shows the steps. On later runs the venv is detected and setup is skipped.
- A Run button in the top bar (next to the settings icon) executes the editor's CadQuery source through a single-shot spawn of the venv Python. A small embedded runner shims `show_object`, executes the script, tessellates the shown shapes, and returns vertices/faces JSON (plus stdout/error).
- A compact output strip at the bottom of the editor pane shows the last run's stdout and errors.
- The 3D viewer renders the returned mesh (replacing the dummy icosahedron); the placeholder remains until the first successful run.

## Capabilities

### New Capabilities
- `python-environment`: Startup detection of Python/venv/pip, the missing-Python error modal, venv bootstrap with progress reporting, and skip-when-ready behavior.
- `cad-script-execution`: Run button, single-shot script execution via the venv Python, and the output strip showing stdout/errors.
- `mesh-viewer`: Rendering of mesh data returned by script execution in the 3D viewer, with placeholder fallback.

### Modified Capabilities
<!-- None — no existing spec behavior changes. -->

## Impact

- New Rust module `src-tauri/src/python.rs`: environment detection/setup, script execution, embedded runner, progress events.
- New Tauri commands: `check_python_setup`, `setup_python`, `run_cad_script`, `exit_app`; progress events `python-setup-progress`.
- New frontend components: `PythonErrorModal`, `PythonSetupModal`, `RunOutput` strip.
- Modified: `App.tsx` (startup gate, run state, source lifted from editor), `TopBar.tsx` (Run button), `CodeEditor.tsx` (controlled source), `ViewerPanel.tsx` (mesh rendering).
- First run downloads CadQuery + OCP (~150 MB) into the cache venv.
