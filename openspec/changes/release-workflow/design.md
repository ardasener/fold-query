## Context

FoldQuery currently has no release infrastructure. The reference project `project-overlook-tauri` (local repo at `/Users/asener/Projects/project-overlook-tauri`) has a working two-part flow:
- `.github/workflows/release.yml` — on `v*` tag push, a 4-platform matrix builds and uploads bundles via `tauri-apps/tauri-action@v0`, creating a draft release.
- `scripts/release.sh` + `"release"` npm script — bumps the version in `tauri.conf.json`, `package.json`, and `Cargo.toml`, commits, tags `v$NEW`, pushes to `origin`.

The reference pushes to a GitHub `origin` while keeping GitLab as the source (`gitlab` remote). FoldQuery currently has only a GitLab remote; the GitHub repo `ardasener/fold-query` already exists.

One FoldQuery-specific interaction: our `fetch-micromamba.ts` downloads and checksum-verifies the bundled micromamba per platform. Only the arm64 macOS checksum is currently pinned; the other three platforms would skip bundling (empty sha256) or fail. For a working cross-platform release, all four must be pinned. The script runs from Tauri's `beforeDevCommand`/`beforeBuildCommand` hooks (not `beforeBundleCommand`, which runs after `cargo build` — tauri-build resolves `externalBin` during the build and fails if the sidecar is absent).

## Goals / Non-Goals

**Goals:**
- GitHub Actions release workflow for macOS (arm64 + Intel), Ubuntu 22.04, and Windows — builds bundles and creates a draft release on `v*` tag push.
- One-command `bun release [--major|--patch]` that keeps `tauri.conf.json`/`package.json`/`Cargo.toml` versions in sync, tags, and pushes to GitHub.
- GitHub `origin` remote added; GitLab remains the source remote.
- Micromamba checksums pinned for all four platforms so the bundle step works on every runner.

**Non-Goals:**
- Automatic GitHub release (draft only — a human publishes).
- Signing/notarization (macOS notarization, Windows signing) — out of scope for now.
- GitLab CI migration — GitHub Actions only.
- Auto-generated changelog/release notes — the workflow uses a fixed body string.

## Decisions

### D1: Adopt the reference workflow nearly verbatim

`.github/workflows/release.yml` mirrors project-overlook: `on: push: tags: ["v*"]`, a matrix of `macos-latest` (both targets), `ubuntu-22.04`, `windows-latest`, with the same setup steps (checkout, setup-node lts, setup-bun pinned, dtolnay/rust-toolchain with macOS targets in an `if`, ubuntu WebKit deps, `bun install`, `tauri-action@v0` with `releaseDraft: true`).

**Why:** the reference is proven in this exact project shape (Tauri 2 + Bun). Deviating adds risk.

### D2: `release.sh` mirrors the reference, pushes to GitHub `origin`

Same flags (`--major`/`--patch`/default minor), same preflight (clean tree, upstream in sync), same version bump across the three metadata files, same `release: v$NEW` commit + `v$NEW` tag. Push targets `origin` (GitHub). A header comment documents the two-remote layout.

**Why:** identical behavior to the reference; keeps the three metadata files in lockstep (the workflow's `tagName: v__VERSION__` must match the app version).

### D3: GitHub `origin` remote, GitLab stays `gitlab`

`git remote add origin git@github.com:ardasener/fold-query.git`. GitLab remains the authoritative source; GitHub is the release mirror. This matches the reference's topology exactly.

### D4: All four micromamba checksums pinned

Fill `scripts/fetch-micromamba.ts` PLATFORMS with the verified SHA-256s:
- `x86_64-apple-darwin`: `d6fce18e…`
- `x86_64-pc-windows-msvc`: `b645a525…`
- `x86_64-unknown-linux-gnu`: `77b7790e…`
- (`aarch64-apple-darwin` already pinned)

The script resolves the platform from `TAURI_ENV_TARGET_TRIPLE` (set by the Tauri CLI for every hook command) so each runner fetches its own binary — this matters for the Intel macOS job (`--target x86_64-apple-darwin` on an arm64 runner). The script's "no checksum → skip" branch becomes dead for release builds (all four pinned), keeping dev builds working without a download when a runner can't reach GitHub.

### D5: Fetch hooks run pre-build, invoked via a package.json script

`tauri.conf.json` runs `bun run fetch-micromamba` in `beforeDevCommand` and `beforeBuildCommand` (chained after the frontend build). `beforeBundleCommand` is *not* used: the build script (tauri-build) validates `externalBin` paths during `cargo build`, so the sidecar must exist before the build starts — a post-build hook fails every platform, not just Windows.

The hook invokes `bun run fetch-micromamba` (a package.json script wrapping `bun scripts/fetch-micromamba.ts`) rather than a raw relative path: Tauri runs hook commands from the CLI invocation directory (the repo root in CI), so `bun ../scripts/...` resolved outside the repo and failed with `Module not found` on all four runners. `bun run` resolves the wrapped script from the package root regardless of CWD.

**Why:** `cargo check` reproduces the first CI failure locally: `resource path 'binaries/micromamba-<triple>' doesn't exist` (build-script ordering). The second CI failure (`Module not found "../scripts/fetch-micromamba.ts"`, all four runners) was the hook CWD issue fixed by wrapping in a package.json script. Verified `bun run fetch-micromamba` from both repo root and `src-tauri/` CWD, and the script under `TAURI_ENV_TARGET_TRIPLE` for all four targets, including the Windows `.exe` naming.

## Risks / Trade-offs

- [Workflow correctness unverifiable without a real tag push + runners] → Mitigate: validate the workflow YAML, dry-run `release.sh`'s version bump (no push), and test `fetch-micromamba.ts` against all four binaries locally. The first real release is the integration test.
- [GitLab → GitHub divergence (code on GitLab, releases on GitHub)] → Same as the reference; documented in the script header and DESIGN.
- [micromamba fetch needs network at bundle time] → Inherent; pinned checksums fail closed rather than shipping a tampered binary.
- [Draft releases require a human to publish] → Intentional (reference behavior).

## Migration Plan

None — new infrastructure. The first release after this change is the pilot: `bun release`, verify the draft on GitHub, publish manually.

## Open Questions

- None blocking. Signing/notarization and auto-changelog are explicit non-goals.
