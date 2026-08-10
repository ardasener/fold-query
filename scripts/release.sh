#!/usr/bin/env bash
set -euo pipefail

# One-command release: verify the tree is clean and in sync with origin, bump
# the version (minor by default; --patch / --major opt in), commit, tag, and
# push. Pushing the v* tag triggers the GitHub release workflow.
#
# Remote layout: GitLab (`gitlab`) is the source of truth for the working
# branch; GitHub (`origin`) is the release mirror that hosts the Actions
# workflow. This script pushes to `origin` (GitHub).

# ── Flag handling ──────────────────────────────────────────────────────────
MAJOR=0
PATCH=0
for arg in "$@"; do
  case "$arg" in
    --major) MAJOR=1 ;;
    --patch) PATCH=1 ;;
    --help)
      echo "usage: bun release [--major|--patch]"
      echo "  (no flag) bump the minor version (default)"
      echo "  --patch   bump the patch version"
      echo "  --major   bump the major version"
      exit 0
      ;;
    *)
      echo "error: unknown argument: $arg" >&2
      echo "usage: bun release [--major|--patch]" >&2
      exit 1
      ;;
  esac
done
if [ "$MAJOR" -eq 1 ] && [ "$PATCH" -eq 1 ]; then
  echo "error: --major and --patch are mutually exclusive" >&2
  exit 1
fi

# ── Preflight ──────────────────────────────────────────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo "error: uncommitted changes present; commit or stash before releasing" >&2
  exit 1
fi

git fetch origin
LOCAL="$(git rev-parse HEAD)"
UPSTREAM="$(git rev-parse @{u} 2>/dev/null || true)"
if [ -z "$UPSTREAM" ]; then
  echo "error: no upstream branch configured for the current branch" >&2
  exit 1
fi
if [ "$LOCAL" != "$UPSTREAM" ]; then
  echo "error: local is out of sync with origin; push/pull first" >&2
  exit 1
fi

# ── Read + bump the version ────────────────────────────────────────────────
# tauri.conf.json is the source of truth: the release tag must match the app
# version the GitHub workflow substitutes into tagName (v__VERSION__).
CURRENT="$(python3 -c 'import json; print(json.load(open("src-tauri/tauri.conf.json"))["version"])')"

IFS='.' read -r MAJ MIN PATCH_N <<<"$CURRENT"
MAJ="${MAJ:-0}"; MIN="${MIN:-0}"; PATCH_N="${PATCH_N:-0}"

if [ "$MAJOR" -eq 1 ]; then
  MAJ=$((MAJ + 1)); MIN=0; PATCH_N=0
elif [ "$PATCH" -eq 1 ]; then
  PATCH_N=$((PATCH_N + 1))
else
  MIN=$((MIN + 1)); PATCH_N=0
fi
NEW="$MAJ.$MIN.$PATCH_N"

echo "release: $CURRENT -> $NEW"

# ── Write the version everywhere ───────────────────────────────────────────
python3 - "$NEW" <<'EOF'
import json, sys
new = sys.argv[1]
for path in ("src-tauri/tauri.conf.json", "package.json"):
    d = json.load(open(path))
    d["version"] = new
    json.dump(d, open(path, "w"), indent=2)
    open(path, "a").write("\n")
EOF
# Cargo.toml: version = "x.y.z" under [package]
sed -i.bak -E "s/^version = \".*\"/version = \"$NEW\"/" src-tauri/Cargo.toml
rm -f src-tauri/Cargo.toml.bak
# Regenerate Cargo.lock so the committed lock matches the bumped manifest
# (metadata resolution writes the root package version; it does not upgrade
# locked dependency versions).
cargo metadata --format-version 1 --manifest-path src-tauri/Cargo.toml > /dev/null

# ── Commit, tag, push ──────────────────────────────────────────────────────
git add src-tauri/tauri.conf.json package.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "release: v$NEW"
git tag "v$NEW"
git push origin HEAD --tags

echo "done: pushed v$NEW (release workflow will create the draft release)"
