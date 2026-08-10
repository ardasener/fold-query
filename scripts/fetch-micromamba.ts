/**
 * Fetches a pinned micromamba binary for the build target platform and places
 * it where Tauri's `externalBin` expects sidecars (src-tauri/binaries/).
 *
 * Run as Tauri's beforeBundleCommand. The version and per-platform checksums
 * are pinned in this file; the build fails if the download doesn't match.
 *
 * Usage: bun scripts/fetch-micromamba.ts [platform]
 *   platform: one of "aarch64-apple-darwin" (default), "x86_64-apple-darwin",
 *             "x86_64-pc-windows-msvc", "x86_64-unknown-linux-gnu"
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src-tauri", "binaries");

/** Pinned micromamba release (mamba-org/micromamba-releases). */
const MICROMAMBA_VERSION = "2.8.1-1";

/** Release asset name -> target-triple -> sha256. */
const PLATFORMS: Record<string, { asset: string; sha256: string }> = {
  "aarch64-apple-darwin": {
    asset: "micromamba-osx-arm64",
    sha256: "9618a2866a2ffb3d36b55e9520f64d63dcd6dc2e622a351ca3cbe8e2cc90c757",
  },
  "x86_64-apple-darwin": {
    asset: "micromamba-osx-64",
    sha256: "d6fce18e56d7c6bf2331b0ee1b372a581c70f09b509cc9e924cdd131e053b58a",
  },
  "x86_64-pc-windows-msvc": {
    asset: "micromamba-win-64",
    sha256: "b645a5259cb92b5869b0e60943390dd0d362cae45bc7e2f5ba8c7e4a4b06c7aa",
  },
  "x86_64-unknown-linux-gnu": {
    asset: "micromamba-linux-64",
    sha256: "77b7790ec97f64581118f103585b175df4306f95829b0fa6bfe4a19cc88a1182",
  },
};

function fail(msg: string): never {
  console.error(`[fetch-micromamba] ${msg}`);
  process.exit(1);
}

async function main() {
  const platform = process.argv[2] ?? "aarch64-apple-darwin";
  const spec = PLATFORMS[platform];
  if (!spec) fail(`Unknown platform "${platform}".`);
  if (!spec.sha256) {
    console.log(`[fetch-micromamba] No pinned checksum for ${platform}; skipping.`);
    return;
  }

  const url = `https://github.com/mamba-org/micromamba-releases/releases/download/${MICROMAMBA_VERSION}/${spec.asset}`;
  console.log(`[fetch-micromamba] Downloading ${spec.asset} (${MICROMAMBA_VERSION})…`);
  const res = await fetch(url);
  if (!res.ok) fail(`Download failed: HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const digest = createHash("sha256").update(buf).digest("hex");
  if (digest !== spec.sha256) {
    fail(`Checksum mismatch for ${spec.asset}: expected ${spec.sha256}, got ${digest}.`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  // Tauri's externalBin expects the source file named with the target-triple
  // suffix (e.g. micromamba-aarch64-apple-darwin); it bundles that name.
  const exe = platform.includes("windows") ? ".exe" : "";
  const out = join(OUT_DIR, `micromamba-${platform}${exe}`);
  writeFileSync(out, buf);
  if (!platform.includes("windows")) chmodSync(out, 0o755);
  console.log(`[fetch-micromamba] OK: ${out} (${(buf.length / 1024).toFixed(0)} KB, sha256 verified)`);
}

main();
