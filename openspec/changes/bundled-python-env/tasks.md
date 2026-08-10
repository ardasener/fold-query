## 1. Build integration (bundled micromamba)

- [x] 1.1 Create `scripts/fetch-micromamba.ts`: reads target platform, downloads `https://micro.mamba.pm/api/micromamba/{subdir}/<PINNED_VERSION>`, verifies the pinned SHA-256, extracts `bin/micromamba` (or `Library/bin/micromamba.exe` on Windows) to `src-tauri/binaries/micromamba`
- [x] 1.2 Add `src-tauri/binaries/` to `.gitignore`
- [x] 1.3 Wire the script as Tauri `beforeBundleCommand` in `tauri.conf.json`
- [x] 1.4 Add `bundle.externalBin: ["binaries/micromamba"]` to `tauri.conf.json`
- [x] 1.5 Verify runtime resolution: `app.path().resolve("micromamba", BaseDirectory::Resource)` returns the sidecar on the build platform
- [x] 1.6 Test the fetch script manually on macOS (arm64): binary downloads, checksum matches, `micromamba --version` runs

## 2. Locked environment snapshot

- [x] 2.1 Create `python/env-foldquery.yaml` with exact pins: `python`, `cadquery=2.8.0`, `ocp=7.9.3.1`, conda-forge channel only
- [x] 2.2 Generate the locked transitive dependency set via a dry-run solve and commit it into the yaml
- [x] 2.3 Verify `micromamba create -f python/env-foldquery.yaml` succeeds on the build machine (venv python)
- [x] 2.4 Embed the yaml into the binary via `include_str!` alongside `runner.py`

## 3. Micromamba-first provisioning (Rust)

- [x] 3.1 Add `micromamba_path()`: resolve the bundled sidecar from resources; return None when absent (dev builds without bundling)
- [x] 3.2 Add micromamba env detection: `<cache>/mamba/envs/foldquery/bin/python` (or `Scripts/python.exe`) works
- [x] 3.3 Implement `provision_micromamba()`: run `micromamba create -f <embedded yaml> -p <cache>/mamba/envs/foldquery -y --root-prefix <cache>/mamba` with `MAMBA_ROOT_PREFIX=<cache>/mamba`, streaming stdout as progress events
- [x] 3.4 Reorder `ensure_environment`: micromamba env fast-path → provision → existing venv path → system-Python fallback (existing code untouched, only ordering)
- [x] 3.5 Extend `SetupStatus` with an environment-source field (`micromamba` | `venv` | `system` | none) in `check_setup`
- [x] 3.6 Handle provisioning failure: fall back to venv/system, report a retryable error

## 4. Setup UI reframing

- [x] 4.1 Extend the frontend setup types (`MissingComponent`/status model) to carry the environment source
- [x] 4.2 Update `PythonSetupModal.tsx`: "Environment" framing, provisioning steps ("Preparing environment…", "Downloading CadQuery packages…", "Verifying…"), one-time note, and source-specific labels (micromamba / existing venv / system)
- [x] 4.3 Update `PythonErrorModal.tsx`: wording explains micromamba-first then system-Python fallback, with retry and manual instructions
- [x] 4.4 Update CSS for the new labels/steps

## 5. Verification

- [x] 5.1 `cargo check` and `cargo test` in `src-tauri/` pass
- [x] 5.2 `bun run build` passes
- [x] 5.3 Smoke test on macOS: fresh cache dir → micromamba env provisions on first launch with progress steps; second launch is instant (no re-provision); existing venv scenario still works and is labeled
