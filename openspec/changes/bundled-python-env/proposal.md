## Why

The app's biggest "works out of the box" blocker is the Python dependency: first launch requires a system Python 3.11+, a working `venv`, and `pip`, with a modal that tells the user to install Python manually. This is fragile (wrong version, missing venv/pip, Apple Silicon headaches) and contradicts the goal of a dependency-free app. Micromamba solves this: it is a fully static, self-contained executable we can bundle, and conda-forge ships prebuilt CadQuery + OpenCascade (`ocp`) binaries for macOS (Intel + Apple Silicon), Windows, and Linux. The environment can be provisioned on first launch inside the app's cache directory with zero system footprint.

## What Changes

- A build script (`scripts/fetch-micromamba.ts`) downloads a **checksum-pinned micromamba binary** for the target platform and bundles it via Tauri's `externalBin` sidecar mechanism. The app ships with micromamba inside the bundle.
- First launch provisions a **locked CadQuery environment** (`python/env-foldquery.yaml`, exact pins: `cadquery=2.8.0`, `ocp=7.9.3.1`, python + locked transitive deps, conda-forge only) into `<cache>/mamba/envs/foldquery`, scoped via `MAMBA_ROOT_PREFIX` to the cache dir.
- The existing system-Python + venv machinery is **kept as a fallback** (unchanged code path), used only when micromamba provisioning is unavailable or fails.
- Existing installations with a working `venv` keep using it — no forced re-provisioning.
- The setup modal is reframed from "Python required" to **"Environment"** and clearly labels which path is active: micromamba provisioning in progress, active micromamba env, existing venv fallback in use, or system-Python fallback in use — so users understand why each path was chosen.

## Capabilities

### New Capabilities
- `bundled-micromamba`: Build-time download + bundling of the pinned micromamba sidecar (per-platform, checksummed), and its runtime location via Tauri resource paths.
- `micromamba-provisioning`: First-launch environment provisioning — locked conda env file, `micromamba create` into the cache dir with a scoped root prefix, progress events, and reproducibility via exact pins.

### Modified Capabilities
- `python-environment`: The setup/detection flow becomes micromamba-first with system-Python fallback; existing venv is recognized and preferred as a fallback; the setup modal is reframed as an environment-provisioning flow with explicit path labeling (micromamba / existing venv / system Python).

## Impact

- **Code**: new `scripts/fetch-micromamba.ts`, new `python/env-foldquery.yaml`, `src-tauri/tauri.conf.json` (`externalBin`), `src-tauri/src/python.rs` (micromamba-first provisioning, fallback ordering), `src-tauri/src/lib.rs` (command wiring), `src/components/python/PythonSetupModal.tsx` + `PythonErrorModal.tsx` (reframed labels + path display).
- **Build**: `beforeBundleCommand` runs the fetch script; `src-tauri/binaries/` holds the downloaded sidecar (gitignored).
- **Dependencies**: none new at runtime. Micromamba binary is vendored at build time (not a crate).
- **No changes** to the sidecar protocol, agent, or Rust unfold pipeline.
