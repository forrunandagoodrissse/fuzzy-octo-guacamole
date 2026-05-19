/**
 * Build all deploy artifacts (obfuscated except public HTML).
 * Usage: node build.mjs
 */

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

run("Vercel JS", process.execPath, ["build.mjs"], join(root, "vercel"));
run("VPS loader", process.execPath, ["build-loader.mjs"], join(root, "vps"));

console.log("\nDone. Deploy:");
console.log("  Vercel → vercel/public/ (HTML untouched, JS obfuscated)");
console.log("  VPS    → vps/loader.obf.php as loader.php (+ vps/public/*.html as-is)");
