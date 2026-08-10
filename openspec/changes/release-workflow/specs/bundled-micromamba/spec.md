## ADDED Requirements

### Requirement: Cross-platform micromamba checksums
The `fetch-micromamba` build script SHALL carry a pinned SHA-256 for each supported release platform, so the bundling step verifies the downloaded binary on every runner.

#### Scenario: Checksum present for every platform
- **WHEN** the script's platform table is inspected
- **THEN** it contains a non-empty pinned checksum for macOS arm64, macOS Intel, Windows, and Linux

#### Scenario: Checksum mismatch fails the build
- **WHEN** a downloaded binary does not match its pinned checksum
- **THEN** the build fails rather than bundling an unverified binary
