## Why

The app has no release pipeline: no CI, no automated builds, and no way to ship installers. Releasing today would mean manually building bundles for each OS. The reference project (project-overlook-tauri) has a proven two-part flow: a GitHub Actions workflow that builds + uploads release assets on a `v*` tag push, and a one-command `release` script that bumps the version in all metadata files, tags, and pushes. FoldQuery should adopt the same flow.

## What Changes

- Add `.github/workflows/release.yml`: a 4-platform matrix (macOS arm64, macOS Intel, Ubuntu 22.04, Windows) that sets up Node/Bun/Rust, installs OS deps, runs `bun install`, and invokes `tauri-apps/tauri-action@v0` to build and upload bundles, creating a **draft GitHub release** on `v*` tag pushes.
- Add `scripts/release.sh` and the `"release": "bash scripts/release.sh"` npm script: preflight (clean tree + in sync with origin), bump the version (minor default, `--patch`/`--major`), write it to `tauri.conf.json`, `package.json`, and `Cargo.toml`, then commit, tag `v$NEW`, and push to `origin`.
- Add the GitHub remote as `origin` (`git@github.com:ardasener/fold-query.git`); GitLab stays as the `gitlab` remote (source of truth). `release.sh` pushes to GitHub, which triggers the workflow.
- Fill in the missing micromamba SHA-256 checksums in `scripts/fetch-micromamba.ts` for Intel macOS, Windows, and Linux so micromamba bundles on every release runner (previously only arm64 macOS had a pinned checksum). The fetch runs from Tauri's `beforeDevCommand`/`beforeBuildCommand` hooks — not `beforeBundleCommand`, which runs after `cargo build` while tauri-build resolves `externalBin` during the build (the original hook ordering failed all four platforms in CI).

## Capabilities

### New Capabilities
- `release-pipeline`: The GitHub Actions release workflow — tag-triggered, 4-platform matrix, `tauri-action` build + draft release upload.
- `release-command`: The `bun release` script — version bump across metadata files, clean-tree/in-sync preflight, commit/tag/push to GitHub.

### Modified Capabilities
- `bundled-micromamba`: `fetch-micromamba.ts` gains pinned checksums for all four supported platforms so the bundling step works on every release runner.

## Impact

- **Code**: new `.github/workflows/release.yml`, new `scripts/release.sh`, `package.json` (release script), `scripts/fetch-micromamba.ts` (checksums), `src-tauri/Cargo.toml` version parity check.
- **Git**: add GitHub `origin` remote (manual step, documented in tasks).
- **No runtime changes** — this is build/release infrastructure only.
