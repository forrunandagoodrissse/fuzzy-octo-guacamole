/**
 * Obfuscates vps/loader.php → loader.obf.php (upload as loader.php on VPS).
 * Edit loader.php first, then: node vps/build-loader.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const root = dirname(fileURLToPath(import.meta.url));
const loaderPath = join(root, "loader.php");
const outNames = process.argv.slice(2);
const defaultOuts = ["loader.obf.php", "5joud6Jn.php"];
const outFiles = outNames.length > 0 ? outNames : defaultOuts;

/** @param {string} code */
function stripPhpComments(code) {
  let out = "";
  let i = 0;
  let state = "code";

  while (i < code.length) {
    const c = code[i];
    const n = code[i + 1];

    if (state === "code") {
      if (c === "/" && n === "/") {
        state = "line";
        i += 2;
        continue;
      }
      if (c === "#") {
        state = "line";
        i += 1;
        continue;
      }
      if (c === "/" && n === "*") {
        state = "block";
        i += 2;
        continue;
      }
      if (c === "'") {
        state = "sq";
        out += c;
        i += 1;
        continue;
      }
      if (c === '"') {
        state = "dq";
        out += c;
        i += 1;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }

    if (state === "line") {
      if (c === "\n") {
        out += c;
        state = "code";
      }
      i += 1;
      continue;
    }

    if (state === "block") {
      if (c === "*" && n === "/") {
        state = "code";
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (state === "sq") {
      out += c;
      i += 1;
      if (c === "\\" && i < code.length) {
        out += code[i];
        i += 1;
      } else if (c === "'") {
        state = "code";
      }
      continue;
    }

    if (state === "dq") {
      out += c;
      i += 1;
      if (c === "\\" && i < code.length) {
        out += code[i];
        i += 1;
      } else if (c === '"') {
        state = "code";
      }
    }
  }

  return out;
}

/** @param {string} code */
function renameFunctions(code) {
  const names = new Set();
  const fnRe = /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  let m;
  while ((m = fnRe.exec(code)) !== null) {
    names.add(m[1]);
  }

  const sorted = [...names].sort((a, b) => b.length - a.length);
  let out = code;
  sorted.forEach((name, idx) => {
    const next = `_w${idx.toString(36)}${randomBytes(2).toString("hex")}`;
    out = out.replace(new RegExp(`\\b${name}\\b`, "g"), next);
  });
  return out;
}

/** @param {string} code */
function renameLocals(code) {
  const vars = ["cfg", "siteUrl", "embedConfig", "bundle", "hosts", "host", "allowedHosts"];
  let out = code;
  vars.forEach((name, idx) => {
    const next = `_v${idx.toString(36)}${randomBytes(2).toString("hex")}`;
    out = out.replace(new RegExp(`\\$${name}\\b`, "g"), `$${next}`);
  });
  return out;
}

/** @param {string} code */
function minify(code) {
  return code.replace(/\s+/g, " ").trim();
}

const raw = readFileSync(loaderPath, "utf8");
if (!raw.includes("$cfg = [")) {
  console.error("loader.php looks already obfuscated — run: git checkout vps/loader.php");
  process.exit(1);
}
let body = raw.replace(/^<\?php\s*/i, "");
body = body.replace(/declare\s*\(\s*strict_types\s*=\s*1\s*\)\s*;/i, "");
body = stripPhpComments(body);
body = renameFunctions(body);
body = renameLocals(body);
body = minify(body);

const payload = gzipSync(Buffer.from(body, "utf8")).toString("base64");

const vPayload = `_p${randomBytes(3).toString("hex")}`;

const out = `<?php
declare(strict_types=1);
$${vPayload}=gzdecode(base64_decode('${payload}'));
$${vPayload}!==false&&eval($${vPayload});
`;

for (const name of outFiles) {
  const outPath = join(root, name);
  writeFileSync(outPath, out, "utf8");
  console.log(`Obfuscated ${outPath} (${out.length} bytes)`);
}
console.log("Upload to VPS — filename must match nginx SCRIPT_FILENAME (e.g. 5joud6Jn.php)");
