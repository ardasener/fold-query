## Context

DESIGN.md's architecture puts the Python sidecar in Rust's control: Rust owns the environment bootstrap and spawns Python to do CadQuery work. This change implements the first slice of that: environment setup (detection → venv → install) and single-shot script execution producing viewer meshes. Decisions from exploration: single-shot spawn per run (persistent stdio sidecar deferred to the agent change), manual Run button in the top bar, output strip in the editor pane, tessellate-to-JSON mesh transport, blocking progress modal, pinned CadQuery dependency.

## Goals / Non-Goals

**Goals:**
- Detect Python 3 (>= 3.11), `venv`, and `pip` on startup; show a tailored error modal with install guidance and an Exit action when missing.
- Bootstrap a venv in the OS cache directory with pinned CadQuery; report progress; skip when the venv already works.
- Run the editor's CadQuery script on demand and return tessellated meshes + stdout/errors.
- Render the resulting mesh in the viewer, keeping the placeholder until the first result.

**Non-Goals:**
- No persistent sidecar process or JSON-RPC transport (deferred to the agent change).
- No agent/LLM integration, no chat wiring, no file save/load of scripts.
- No model import (STL/STEP) or export.
- No sandbox beyond a timeout and restricted working directory (a full consent/sandbox design is deferred per DESIGN.md).

## Decisions

### D1: Environment location — OS cache directory
Venv lives at `app.path().app_cache_dir()/venv` (Tauri 2 core `PathResolver`): `~/Library/Caches/com.foldquery.app/venv` on macOS, `~/.cache/...` on Linux, `%LOCALAPPDATA%/.../cache` on Windows. Rationale: cache is the OS-sanctioned place for disposable, re-creatable data; the venv is exactly that. The directory also holds `requirements.txt` (written during setup) and the embedded `runner.py` (materialized at setup time so execution can spawn it by path).

### D2: Version policy — require Python >= 3.11
CadQuery 2.8.0 declares `requires_python >= 3.11`; OCP ships ABI-independent (`py3-none-any`) ctypes wheels, so recent CPython (including 3.14) works. Detection parses `python3 --version` and rejects anything below 3.11 with the error modal.

### D3: Startup gate with blocking setup
On mount the frontend invokes `check_python_setup`. States: `ready` → workbench; `needs_setup` → `setup_python` runs with a blocking progress modal; `missing` → non-dismissible error modal. While the check itself is in flight, a modal with a spinner ("Checking Python environment…") keeps the workbench hidden. Rationale: the workbench is useless without Python, so blocking is correct and simpler.

### D4: Tailored error modal
`check_python_setup` reports exactly what is missing (`python` | `venv` | `pip`). The modal title/body adapt (e.g., Debian/Ubuntu users typically need `python3-venv`), shows a python.org link, per-OS install commands (macOS: `brew install python@3.12`; Debian/Ubuntu: `apt install python3 python3-venv python3-pip`; Windows: `winget install Python.Python.3.12`), and an Exit button (`exit_app` command → `app.exit(0)`).

### D5: Setup steps and skip-when-ready
`ensure_environment(app)`: if `<cache>/venv/bin/python` (Windows: `Scripts/python.exe`) runs `--version` successfully → ready, skip. Otherwise: create venv with system Python → `python -m pip install --upgrade pip` → `pip install -r requirements.txt` (pinned `cadquery>=2.8,<3`) → verify `import cadquery`. Each step emits a `python-setup-progress` event `{ step, message }`. Failures emit an error the modal surfaces with Retry/Exit.

### D6: Single-shot execution (this change)
`run_cad_script` spawns `<venv>/bin/python <cache>/runner.py` once per run, writes the editor source to the child's stdin, waits with a 30s timeout (kills on timeout), and parses the runner's JSON from stdout. Rationale: simplest robust path; ~1-3s per run due to OCP import is acceptable until the agent needs a persistent session. Blocking work runs via `tauri::async_runtime::spawn_blocking` so the UI stays responsive.

### D7: Embedded runner
`runner.py` is embedded in the Rust binary via `include_str!` and synced into the cache dir on every `ensure_environment` call (idempotent), so app updates always propagate the current runner — not just during initial setup. It shims `show_object`, executes the source via `exec(compile(...))` with `show_object` in scope, redirects stdout, tessellates each shown shape (`shape.tessellate(0.1)` → flat vertex/face arrays via `.x/.y/.z` access), and prints one JSON object: `{ stdout, error, objects: [{vertices, faces}] }`. Tracebacks are captured into `error`, not lost to stderr.

### D8: Mesh transport — tessellate to JSON
Meshes travel as flat number arrays over the command result — no file formats, no loaders. The frontend builds a `THREE.BufferGeometry` (position attribute + index + `computeVertexNormals`) and renders it with the theme's primary material and edge lines. Rationale: direct, dependency-free; binary encoding can come later if payloads grow.

### D9: Manual Run button in the top bar
Run button sits in the top bar next to the settings icon, disabled while Python isn't ready or a run is in progress. Editor source is lifted into `App` (controlled `CodeEditor`), so Run always executes the current buffer. Rationale: predictable and cheap; auto-run would burn CPU on every keystroke.

### D10: Output strip in the editor pane
A compact `RunOutput` strip at the bottom of the left pane (visible when the editor view is active) shows the last run's stdout (monospace, scrollable) and any error (distinct color), with a dismiss control. Rationale: keeps script feedback next to the code without a full console feature.

### D11: Viewer placeholder until first result
The viewer keeps the icosahedron placeholder when no mesh exists; on the first successful run it renders the returned mesh. A failed run leaves the previous mesh/placeholder in place and surfaces the error in the output strip.

## Risks / Trade-offs

- [First-run download is ~150 MB (CadQuery + OCP)] → Progress modal reports steps; cache dir is disposable; subsequent runs skip setup.
- [Python not installed / wrong version on user machines] → Tailored error modal; the app degrades gracefully.
- [pip install may fail (no network, unsupported Python)] → Setup modal shows the failure with Retry/Exit.
- [Executing arbitrary editor code] → 30s timeout + kill; working directory is the cache dir. A full sandbox/consent design remains deferred (DESIGN.md).
- [Spawn-from-Finder PATH issues on macOS] → Dev inherits the shell PATH; document that the app looks up `python3` via PATH. Revisit with explicit binary resolution if it bites.
- [Tessellation of very dense meshes] → Fine for authored scripts; watch payload size, switch to binary transport if needed.
