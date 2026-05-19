/**
 * Build all deploy artifacts (obfuscated except public HTML).
 * Usage: node build.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

function run(label, cmd, args, cwd) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function syncLoaderBundleUrl() {
  const names = JSON.parse(readFileSync(join(root, "vercel/asset-names.json"), "utf8"));
  const loaderPath = join(root, "vps/loader.php");
  let loader = readFileSync(loaderPath, "utf8");
  const next = loader.replace(
    /('vercel_bundle_url'\s*=>\s*'https:\/\/[^/]+\/)[^']+'/,
    `$1${names.bundle}'`
  );
  if (next === loader) {
    if (!/'vercel_bundle_url'\s*=>\s*'https:\/\/[^/]+\/[^']+'/.test(loader)) {
      console.warn("Could not sync vercel_bundle_url filename in vps/loader.php");
    }
    return;
  }
  writeFileSync(loaderPath, next, "utf8");
  console.log(`Synced vps/loader.php vercel_bundle_url → ${names.bundle}`);
}

syncLoaderBundleUrl();
run("Vercel JS", process.execPath, ["build.mjs"], join(root, "vercel"));
run("VPS loader", process.execPath, ["build-loader.mjs"], join(root, "vps"));

const names = JSON.parse(readFileSync(join(root, "vercel/asset-names.json"), "utf8"));
console.log("\nDone. Deploy:");
console.log(`  Vercel bundle: /${names.bundle}`);
console.log(`  Vercel profile script: /profile/${names.profileScript}`);
console.log("  VPS → vps/loader.obf.php as loader.php");
