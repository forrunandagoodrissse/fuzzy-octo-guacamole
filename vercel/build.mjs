import * as esbuild from "esbuild";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { obfuscateJs } from "./scripts/obfuscate.mjs";

/** Obfuscate project source before esbuild bundles vendor deps (fast on small files). */
const obfuscateSourcePlugin = {
  name: "obfuscate-src",
  setup(build) {
    build.onLoad({ filter: /[/\\]src[/\\].+\.js$/ }, async (args) => {
      const source = await readFile(args.path, "utf8");
      return {
        contents: obfuscateJs(source, {
          controlFlowFlatteningThreshold: 1,
          stringArrayWrappersCount: 2,
        }),
        loader: "js",
      };
    });
  },
};

const gen = spawnSync(process.execPath, ["scripts/generate-solana-wallets.mjs"], {
  stdio: "inherit",
});

if (gen.status !== 0) {
  if (!existsSync("src/solana-wallets.js")) {
    console.error("Missing src/solana-wallets.js — commit it or set reown_project_id in ../vps/loader.php");
    process.exit(1);
  }
  console.warn("Wallet list not regenerated — using existing src/solana-wallets.js");
}

await mkdir("public", { recursive: true });
await mkdir("public/profile", { recursive: true });

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
  plugins: [obfuscateSourcePlugin],
});

console.log("Built public/wallet.bundle.js (app code obfuscated, Reown/Solana libs minified only)");

const profileSource = await readFile("src/profile-page.js", "utf8");
const obfuscatedProfile = obfuscateJs(profileSource, {
  controlFlowFlatteningThreshold: 1,
  stringArrayWrappersCount: 2,
});
await writeFile("public/profile/page.js", obfuscatedProfile, "utf8");
console.log("Built public/profile/page.js");
