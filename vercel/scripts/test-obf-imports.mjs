import * as esbuild from "esbuild";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { obfuscateJs } from "./obfuscate.mjs";
import { browserDepsPlugin } from "./browser-deps-plugin.mjs";

const SKIP_OBFUSCATE = /[/\\]src[/\\](?:browser-shims|solana-wallets)\.js$/;

async function buildWithObf(label, obfOptions) {
  const plugin = {
    name: "obfuscate-src",
    setup(build) {
      build.onLoad({ filter: /[/\\]src[/\\].+\.js$/ }, async (args) => {
        if (SKIP_OBFUSCATE.test(args.path)) {
          return { contents: await readFile(args.path, "utf8"), loader: "js" };
        }
        const source = await readFile(args.path, "utf8");
        return {
          contents: obfuscateJs(source, obfOptions),
          loader: "js",
        };
      });
    },
  };

  const out = `public/test-${label}.js`;
  await esbuild.build({
    entryPoints: ["src/wallet-loader.js"],
    outfile: out,
    bundle: true,
    packages: "bundle",
    format: "iife",
    globalName: "ReownWalletEmbed",
    platform: "browser",
    target: ["es2020"],
    inject: ["src/browser-shims.js"],
    plugins: [browserDepsPlugin(), plugin],
    minify: true,
  });

  const s = readFileSync(out, "utf8");
  console.log(label, {
    imports: [...s.matchAll(/import\s*\(/g)].length,
    bare: s.includes("@reown/appkit-scaffold-ui/"),
  });
}

await buildWithObf("prod-like", {
  controlFlowFlatteningThreshold: 1,
  stringArrayWrappersCount: 2,
});
await buildWithObf("light", {
  controlFlowFlattening: false,
  stringArrayWrappersCount: 1,
});
await buildWithObf("none", {
  controlFlowFlattening: false,
  stringArray: false,
});
