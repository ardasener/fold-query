## ADDED Requirements

### Requirement: Bundled micromamba binary
The app build SHALL download a micromamba executable for the build target platform and bundle it into the app via Tauri's external sidecar mechanism.

#### Scenario: Build downloads pinned micromamba
- **WHEN** the app is bundled for a supported platform (macOS arm64/x64, Windows x64, Linux x64)
- **THEN** a micromamba binary is downloaded, its SHA-256 matches the pinned checksum, and it is placed where Tauri's `externalBin` expects it

#### Scenario: Checksum mismatch fails the build
- **WHEN** the downloaded binary's checksum does not match the pinned value
- **THEN** the build fails with a clear error rather than shipping a tampered binary

#### Scenario: Runtime sidecar resolution
- **WHEN** the app runs
- **THEN** the bundled micromamba executable is resolvable via the app's resource directory

### Requirement: Locked environment snapshot
The repo SHALL contain a checked-in conda environment file with exact version pins for CadQuery, its OpenCascade bindings (`ocp`), Python, and the transitive dependency set, using conda-forge only. Python is pinned to 3.13 because the conda-forge py312 `ocp` builds crash on import on macOS arm64.

#### Scenario: Reproducible installs
- **WHEN** the environment is created from the locked file
- **THEN** the resolved package set is identical to the pinned snapshot regardless of when the install runs

#### Scenario: CadQuery imports and runs
- **WHEN** the locked environment's Python imports CadQuery and tessellates a shape
- **THEN** it succeeds without crashing
