## 1. GitHub Actions release workflow

- [x] 1.1 Create `.github/workflows/release.yml` mirroring the reference: tag trigger (`v*`), 4-platform matrix (macos-latest arm64 + x86_64, ubuntu-22.04, windows-latest)
- [x] 1.2 Add setup steps: checkout, setup-node lts, setup-bun pinned, dtolnay/rust-toolchain (macOS targets in an `if`), ubuntu WebKit deps, `bun install`
- [x] 1.3 Add `tauri-apps/tauri-action@v0` with `tagName: v__VERSION__`, `releaseName`, `releaseDraft: true`, `GITHUB_TOKEN`
- [x] 1.4 Validate the workflow YAML parses (e.g. via `actionlint` if available, or a YAML parse)

## 2. Release script

- [x] 2.1 Create `scripts/release.sh` (chmod +x): flags (`--major`/`--patch`/default minor), preflight (clean tree + upstream in sync), read version from `tauri.conf.json`, bump, write to `tauri.conf.json` + `package.json` + `Cargo.toml`, commit `release: v$NEW`, tag `v$NEW`, push to `origin`
- [x] 2.2 Add `"release": "bash scripts/release.sh"` to `package.json` scripts
- [x] 2.3 Header comment in the script documenting the two-remote layout (GitLab source, GitHub origin)
- [x] 2.4 Dry-run the version bump logic locally without pushing (temp copy of metadata files)

## 3. Micromamba checksums

- [x] 3.1 Fill `scripts/fetch-micromamba.ts` PLATFORMS with the verified sha256 for `x86_64-apple-darwin`, `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu` (aarch64 already pinned)
- [x] 3.2 Verify the fetch script downloads + checksum-verifies each of the four binaries locally (one at a time, into temp dirs)

## 4. Git remotes

- [x] 4.1 Add the GitHub remote: `git remote add origin git@github.com:ardasener/fold-query.git`
- [x] 4.2 Confirm `git remote -v` shows both `gitlab` (source) and `origin` (GitHub)
- [x] 4.3 Verify push permission to the GitHub repo is configured (e.g. SSH key / `ssh -T git@github.com`)

## 5. Verification

- [x] 5.1 `bun run build` and `cargo check` still pass (no runtime code changed)
- [x] 5.2 `bun run release --help` prints the usage text
- [x] 5.3 Confirm the workflow file exists at `.github/workflows/release.yml` and references valid actions
- [ ] 5.4 (Pilot, manual) First real release: `bun release`, verify the draft on GitHub, publish
