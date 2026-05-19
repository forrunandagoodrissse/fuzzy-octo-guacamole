/**
 * Keep vercel.json header routes in sync with asset-names.json.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const vercelRoot = join(root, "..");

/** @param {{ bundle: string; profileScript: string }} names */
export function syncVercelJsonHeaders(names) {
  const configPath = join(vercelRoot, "vercel.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));

  config.headers = [
    {
      source: `/${names.bundle}`,
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        { key: "Access-Control-Allow-Origin", value: "*" },
      ],
    },
    {
      source: `/profile/${names.profileScript}`,
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
  ];

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}
