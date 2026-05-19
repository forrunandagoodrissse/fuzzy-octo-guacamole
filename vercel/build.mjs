import * as esbuild from "esbuild";
import { existsSync, unlinkSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { obfuscateJs } from "./scripts/obfuscate.mjs";
import { syncVercelJsonHeaders } from "./scripts/sync-vercel-json.mjs";
import { browserDepsPlugin } from "./scripts/browser-deps-plugin.mjs";

const profileHtmlTpl = "public/profile/index.template.html";

/** @type {{ bundle: string; profileScript: string }} */
const assetNames = JSON.parse(await readFile("asset-names.json", "utf8"));

syncVercelJsonHeaders(assetNames);
console.log("Synced vercel.json headers");

const bundleOut = join("public", assetNames.bundle);
const profileScriptOut = join("public/profile", assetNames.profileScript);
const profileHtmlPath = "public/profile/index.html";

const SKIP_OBFUSCATE = /[/\\]src[/\\](?:browser-shims|solana-wallets)\.js$/;

/** Obfuscate project source before esbuild bundles vendor deps (fast on small files). */
const obfuscateSourcePlugin = {
  name: "obfuscate-src",
  setup(build) {
    build.onLoad({ filter: /[/\\]src[/\\].+\.js$/ }, async (args) => {
      if (SKIP_OBFUSCATE.test(args.path)) {
        return { contents: await readFile(args.path, "utf8"), loader: "js" };
      }

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

const faviconSrc = join("..", "vps", "public", "tYZq2BsVawvS5wYEF.svg");
const faviconOut = join("public", "tYZq2BsVawvS5wYEF.svg");
if (existsSync(faviconSrc)) {
  await copyFile(faviconSrc, faviconOut);
  console.log("Copied favicon → public/tYZq2BsVawvS5wYEF.svg");
}

for (const stale of ["public/wallet.bundle.js", "public/profile/page.js"]) {
  if (existsSync(stale)) unlinkSync(stale);
}

await esbuild.build({
  entryPoints: ["src/wallet-loader.js"],
  outfile: bundleOut,
  bundle: true,
  packages: "bundle",
  format: "iife",
  globalName: "ReownWalletEmbed",
  platform: "browser",
  target: ["es2020"],
  mainFields: ["browser", "module", "main"],
  conditions: ["browser", "import", "module", "default"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
  inject: ["src/browser-shims.js"],
  plugins: [browserDepsPlugin(), obfuscateSourcePlugin],
});

const bundleJs = await readFile(bundleOut, "utf8");
if (bundleJs.includes("Dynamic require of")) {
  console.error(
    "Bundle contains esbuild dynamic require shim — do not deploy. Rebuild or adjust obfuscator/esbuild options.",
  );
  process.exit(1);
}

console.log(`Built ${bundleOut} (app code obfuscated, vendor minified only)`);

const profileSource = await readFile("src/profile-page.js", "utf8");
const obfuscatedProfile = obfuscateJs(profileSource, {
  controlFlowFlatteningThreshold: 1,
  stringArrayWrappersCount: 2,
});
await writeFile(profileScriptOut, obfuscatedProfile, "utf8");
console.log(`Built ${profileScriptOut}`);

const htmlSource = await readFile(profileHtmlTpl, "utf8");

const profileHtml = htmlSource.replace("__PROFILE_SCRIPT__", assetNames.profileScript);
await writeFile(profileHtmlPath, profileHtml, "utf8");
console.log(`Updated ${profileHtmlPath} → ${assetNames.profileScript}`);
