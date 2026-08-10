## Context

The app's Python environment today is system-Python + venv + pip, provisioned on first launch in `<cache>/venv`. It requires Python 3.11+, `venv`, and `pip` present on the host, with a modal instructing manual install when missing. The goal: a dependency-free app that works out of the box.

Micromamba is a fully statically-linked, self-contained executable (BSD-3), downloadable per-platform from `https://micro.mamba.pm/api/micromamba/{subdir}/<version>` as a small tar.bz2. It uses `MAMBA_ROOT_PREFIX` to scope all environments and caches to a directory of our choosing. conda-forge ships `cadquery=2.8.0` (noarch) and `ocp=7.9.3.1` (the OpenCascade bindings — the heavy binary) for osx-arm64, osx-64, win-64, and linux-64. This replaces the system-Python requirement entirely for the primary path.

## Goals / Non-Goals

**Goals:**
- Micromamba binary bundled into the app at build time (checksum-pinned, per-platform, via Tauri `externalBin`).
- First launch provisions a locked CadQuery env into the cache dir with a scoped root prefix; subsequent launches reuse it instantly.
- System-Python + venv path retained as a clearly-labeled fallback; existing venvs keep working, no forced re-provisioning.
- Setup UI reframed as environment provisioning with explicit active-path labeling.
- Reproducible: exact-pinned env snapshot, versioned alongside the micromamba pin.

**Non-Goals:**
- Fully offline installer (bundling the entire conda env ~500MB-1GB) — rejected (Q1/B).
- Runtime self-download of micromamba — rejected (Q2/B); build-time bundling only.
- Removing the system-Python fallback — rejected (Q3/A); fallback stays.
- Automatic venv deletion/migration — rejected (Q4/C).

## Decisions

### D1: Build-time download of a pinned micromamba sidecar

`scripts/fetch-micromamba.ts` (Bun) runs as Tauri `beforeBundleCommand`:
- Determines the target platform from an env/arg (macOS arm64/x64, Windows x64, Linux x64).
- Downloads `https://micro.mamba.pm/api/micromamba/{subdir}/<PINNED_VERSION>` (a tar.bz2 containing `bin/micromamba` or `Library/bin/micromamba.exe`).
- Verifies a SHA-256 pinned in the repo; fails the build on mismatch.
- Extracts to `src-tauri/binaries/micromamba` (gitignored); Tauri `externalBin: ["binaries/micromamba"]` renames it with the target-triple suffix (`micromamba-aarch64-apple-darwin`, etc.) and ships it as a sidecar.

Runtime lookup: `app.path().resolve("micromamba", BaseDirectory::Resource)` returns the sidecar path (Tauri appends the triple suffix automatically for `externalBin`).

**Why:** one download at build time, checksummed, reproducible; the released app contains the binary, so first-launch provisioning only downloads the *environment* (packages), not the tool.

### D2: Locked environment snapshot

`python/env-foldquery.yaml`, checked in:
```yaml
name: foldquery
channels:
  - conda-forge
dependencies:
  - python=3.12.*        # or exact, decided at implementation from the locked resolve
  - cadquery=2.8.0
  - ocp=7.9.3.1
  # ... transitive pins captured from a locked solve
```
The full transitive set is generated once via `micromamba create --dry-run --json` (or `conda-lock`-style) and committed, so every install resolves identically. Bumping versions is a deliberate, tested change coordinated with the micromamba pin.

### D3: Micromamba-first provisioning with scoped root prefix

In `python.rs`, `ensure_environment` becomes:
1. **Fast path:** `<cache>/mamba/envs/foldquery/bin/python` (or `Scripts/python.exe`) works → return it.
2. **Provision:** run the bundled micromamba:
   `micromamba create -f <embedded env.yaml> -p <cache>/mamba/envs/foldquery -y --root-prefix <cache>/mamba`
   with `MAMBA_ROOT_PREFIX=<cache>/mamba` in the env, and progress events emitted on stdout lines (`Preparing environment`, `Downloading packages`, `Linking`, `Verifying`).
3. **Fallback:** existing venv logic unchanged — `venv_python_path()`/`find_system_python()` paths remain, tried only when micromamba is unavailable or provisioning fails.

The embedded `env.yaml` and `runner.py` stay `include_str!`'d for atomic updates.

### D4: Existing venv preferred as fallback (no forced migration)

`check_setup` reports a new `env_source` dimension: `micromamba` (primary, ready) / `venv` (existing fallback in use) / `system` (system-Python fallback) / none. If a working venv exists it is *not* deleted or re-provisioned; the UI labels it as the active environment. Micromamba provisioning is only attempted when no working env exists at all.

### D5: Setup UI reframed as environment provisioning

`PythonSetupModal` becomes an "Environment" flow with explicit labels:
- **Provisioning:** spinner + steps ("Preparing environment…", "Downloading CadQuery packages…", "Verifying…") + note "This only happens once."
- **Active micromamba env:** informational line showing the env path.
- **Existing venv fallback:** label "Using existing environment from <path>".
- **System-Python fallback:** label "Using your system Python as a fallback (micromamba unavailable)."
- **Both failed:** `PythonErrorModal` reworded: micromamba was tried first, system Python second; manual install instructions retained with retry.

The modal's `MissingComponent` enum is replaced/extended with a provisioning-status model so the frontend can render the active path accurately.

## Risks / Trade-offs

- [First-launch needs network once (package download)] → Inherent to Q1/A; scoped to a one-time provisioning, with the existing venv/system fallback covering offline environments. Documented in the UI.
- [conda-forge availability could change] → Exact pins + the `ocp`/`cadquery` versions verified present on all 4 platforms today; pinning freezes what we tested.
- [Micromamba binary size in bundle (~5-10MB)] → Acceptable; far smaller than bundling the env (Q1/B rejected).
- [externalBin path/suffix subtleties across platforms] → Covered by Tauri's documented sidecar handling; verified at implementation on macOS first, Windows/Linux follow.
- [Provisioning failure mid-download leaves a partial env] → `micromamba create` is atomic-ish (locks the prefix); a failed run is retried from scratch; fallback path covers the user meanwhile.
- [System-Python fallback behavior regressing] → Code path is unchanged; only ordering changes (micromamba first).

## Migration Plan

Existing users: nothing is deleted. `check_setup` detects the working venv first (fast path unchanged conceptually), labels it in the UI, and only provisions micromamba on fresh installs. The `requirements.txt` embedded file is superseded by `env-foldquery.yaml`; both may coexist during the transition, with the yaml authoritative.

## Open Questions

- None blocking. Exact transitive pins are generated during implementation from a dry-run solve; the micromamba version pin is chosen at implementation time from current stable releases.
- Resolved during implementation: the conda-forge **py312 `ocp` builds crash on import on osx-arm64** (SIGKILL during `import OCP`/`import cadquery`, ~88MB RSS — a package bug, not OOM). The lock therefore pins **Python 3.13**, whose `ocp=7.9.3.1=py313h55303a7_4` build imports and tessellates cleanly. This is recorded in the env file's header comment.
