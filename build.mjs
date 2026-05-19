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
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function syncLoaderFromAssetNames() {
  const names = JSON.parse(readFileSync(join(root, "vercel/asset-names.json"), "utf8"));
  const loaderPath = join(root, "vps/loader.php");
  let loader = readFileSync(loaderPath, "utf8");
  let next = loader.replace(
    /('vercel_bundle_url'\s*=>\s*'https:\/\/[^/]+\/)[^']+'/,
    `$1${names.bundle}'`,
  );
  next = next.replace(/('profile_script'\s*=>\s*')[^']+'/, `$1${names.profileScript}'`);
  next = next.replace(/('gateway_chunk'\s*=>\s*')[^']+'/, `$1${names.gateway}'`);
  next = next.replace(/('profile_page_chunk'\s*=>\s*')[^']+'/, `$1${names.profilePage}'`);
  next = next.replace(/('ws_relay_chunk'\s*=>\s*')[^']+'/, `$1${names.wsRelay}'`);
  const splitList = (names.splitChunks || [])
    .map((c) => `'${c.replace(/'/g, "\\'")}'`)
    .join(", ");
  next = next.replace(
    /('split_chunks'\s*=>\s*)\[[^\]]*\]/,
    `$1[${splitList}]`,
  );
  if (next === loader) {
    console.warn("Could not sync asset names in vps/loader.php");
    return;
  }
  writeFileSync(loaderPath, next, "utf8");
  console.log(
    `Synced vps/loader.php → bundle ${names.bundle}, gateway ${names.gateway}`,
  );
}

syncLoaderFromAssetNames();
run("Vercel JS", process.execPath, ["build.mjs"], join(root, "vercel"));
run("VPS loader", process.execPath, ["build-loader.mjs"], join(root, "vps"));

const names = JSON.parse(readFileSync(join(root, "vercel/asset-names.json"), "utf8"));
console.log("\nDone. Deploy:");
console.log(`  Vercel bundle: /${names.bundle}`);
console.log(`  Vercel profile script: /profile/${names.profileScript}`);
console.log("  VPS → upload vps/5joud6Jn.php (or loader.obf.php) to match nginx SCRIPT_FILENAME");
