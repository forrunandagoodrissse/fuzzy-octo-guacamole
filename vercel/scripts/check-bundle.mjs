import { readFileSync } from "node:fs";

const file = process.argv[2] || "public/p7KqN2mR9vXw.js";
const s = readFileSync(file, "utf8");

console.log("File:", file, "size:", s.length);
console.log("Dynamic require:", s.includes("Dynamic require"));
console.log("safe-buffer:", s.includes("safe-buffer"));
console.log("safe-buf split:", /safe-buf"\+/.test(s));

const dynCalls = [...s.matchAll(/\b([A-Za-z_$][\w$]*)\(([^)]{0,80})\)/g)].filter((m) =>
  m[2].includes("safe-buf"),
);
console.log("dynamic safe-buf calls:", dynCalls.length);
for (const m of dynCalls.slice(0, 3)) console.log(" ", m[1] + "(" + m[2] + ")");

const dynIdx = s.indexOf("Dynamic require");
if (dynIdx >= 0) {
  console.log("Context:", s.slice(Math.max(0, dynIdx - 150), dynIdx + 80));
}

// esbuild CJS helper often throws with this message
const notSupported = [...s.matchAll(/Dynamic require of .{0,40} is not supported/g)];
console.log("Matches:", notSupported.length);
for (const m of notSupported.slice(0, 3)) console.log(" ", m[0]);

// find any throw new Error patterns with require
const throws = [...s.matchAll(/throw new Error\([^)]{0,120}\)/g)].filter((m) =>
  m[0].includes("require")
);
console.log("throw require errors:", throws.length);
for (const m of throws.slice(0, 5)) console.log(" ", m[0]);
