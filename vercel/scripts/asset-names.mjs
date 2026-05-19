/**
 * Generate random JS output filenames (committed in asset-names.json).
 * Usage: node scripts/asset-names.mjs [--write]
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { syncVercelJsonHeaders } from "./sync-vercel-json.mjs";

const root = dirname(fileURLToPath(import.meta.url));
const file = join(root, "..", "asset-names.json");

function randomJsName() {
  const raw = randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
  return raw.slice(0, 12) + ".js";
}

const force = process.argv.includes("--write");

if (!force && existsSync(file)) {
  console.log(readFileSync(file, "utf8"));
  process.exit(0);
}

const names = {
  bundle: randomJsName(),
  profileScript: randomJsName(),
};

writeFileSync(file, JSON.stringify(names, null, 2) + "\n", "utf8");
syncVercelJsonHeaders(names);
console.log("Wrote asset-names.json:", names);
console.log("Synced vercel.json headers");
