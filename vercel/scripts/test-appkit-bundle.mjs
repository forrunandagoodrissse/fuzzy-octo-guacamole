import * as esbuild from "esbuild";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { browserDepsPlugin } from "./browser-deps-plugin.mjs";
import { obfuscateJs } from "./obfuscate.mjs";

const SKIP_OBFUSCATE = /[/\\]src[/\\](?:browser-shims|solana-wallets)\.js$/;

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

await esbuild.build({
  entryPoints: ["src/wallet-loader.js"],
  outfile: "public/test-appkit.js",
  bundle: true,
  packages: "bundle",
  format: "iife",
  globalName: "T",
  platform: "browser",
  target: ["es2020"],
  inject: ["src/browser-shims.js"],
  plugins: [browserDepsPlugin(), obfuscateSourcePlugin],
  minify: true,
});

const s = readFileSync("public/test-appkit.js", "utf8");
console.log("has bare send:", s.includes("@reown/appkit-scaffold-ui/send"));
console.log("import( count:", [...s.matchAll(/import\s*\(/g)].length);
