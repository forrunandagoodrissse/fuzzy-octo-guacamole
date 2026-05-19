import * as esbuild from "esbuild";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const gen = spawnSync(process.execPath, ["scripts/generate-solana-wallets.mjs"], {
  stdio: "inherit",
});

if (gen.status !== 0) {
  if (!existsSync("src/solana-wallets.js")) {
    console.error("Missing src/solana-wallets.js — commit it or set reown_project_id in ../vps/config.php");
    process.exit(1);
  }
  console.warn("Wallet list not regenerated — using existing src/solana-wallets.js");
}

await mkdir("public", { recursive: true });

await esbuild.build({
  entryPoints: ["src/wallet-loader.js"],
  outfile: "public/wallet.bundle.js",
  bundle: true,
  format: "iife",
  globalName: "ReownWalletEmbed",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
});

console.log("Built public/wallet.bundle.js");
