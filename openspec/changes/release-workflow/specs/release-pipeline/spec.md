## ADDED Requirements

### Requirement: Tag-triggered release build
The repo SHALL contain a GitHub Actions workflow that builds and uploads release bundles when a `v*` tag is pushed, for macOS (arm64 and x86_64), Ubuntu 22.04, and Windows.

#### Scenario: Tag push triggers builds
- **WHEN** a tag matching `v*` is pushed to GitHub
- **THEN** the workflow runs the four-platform build matrix (macOS arm64, macOS Intel, Ubuntu 22.04, Windows)

#### Scenario: Draft release created
- **WHEN** all matrix builds succeed
- **THEN** a draft GitHub release is created for the tag with the built bundles attached

#### Scenario: macOS targets built
- **WHEN** the macOS runner builds
- **THEN** both `aarch64-apple-darwin` and `x86_64-apple-darwin` targets are produced

#### Scenario: Linux system deps installed
- **WHEN** the Ubuntu 22.04 runner builds
- **THEN** the WebKitGTK and related system packages are installed before the build

### Requirement: Micromamba bundled on all release platforms
The release builds SHALL bundle the micromamba sidecar for every supported platform, not just arm64 macOS.

#### Scenario: All platforms have pinned checksums
- **WHEN** the `fetch-micromamba` build step runs on any release platform
- **THEN** a pinned SHA-256 exists for that platform and the downloaded binary is verified against it

#### Scenario: Release bundle contains micromamba
- **WHEN** a release bundle is built for a supported platform
- **THEN** the micromamba executable is present in the app bundle

### Requirement: One-command release
The repo SHALL provide a `release` npm script that bumps the version, updates all metadata files, tags, and pushes to trigger the workflow.

#### Scenario: Minor bump by default
- **WHEN** `bun release` runs with no flags
- **THEN** the minor version increments and patch resets to zero

#### Scenario: Patch and major flags
- **WHEN** `bun release --patch` or `bun release --major` runs
- **THEN** the patch or major version increments accordingly

#### Scenario: Versions stay in sync
- **WHEN** the release script bumps the version
- **THEN** `tauri.conf.json`, `package.json`, and `Cargo.toml` all carry the new version

#### Scenario: Clean-tree preflight
- **WHEN** the release script runs with uncommitted changes or an out-of-sync branch
- **THEN** it aborts with an error before touching the version

#### Scenario: Tag push triggers the workflow
- **WHEN** the release script commits and tags the new version
- **THEN** it pushes the tag to the GitHub remote, which triggers the release workflow
