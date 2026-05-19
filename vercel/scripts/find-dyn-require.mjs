import { readFileSync } from "node:fs";

const file = process.argv[2];
const s = readFileSync(file, "utf8");
const re = /throw Error\('Dynamic require of "'\+(\w+)\+'" is not supported'\)/;
const helper = s.match(re);
console.log("helper arg var:", helper?.[1]);

const calls = [...s.matchAll(/\b(\w{1,3})\(([^)]{0,120})\)/g)].filter((m) => {
  const arg = m[2];
  return arg.includes("safe") || arg.includes("buffer") || /^"[a-z-]+"/.test(arg);
});
console.log("suspicious calls:", calls.length);
for (const m of calls.slice(0, 20)) {
  if (m[2].length < 80) console.log(m[1] + "(" + m[2] + ")");
}

const idx = s.indexOf("safe-buffer");
console.log("safe-buffer literal:", idx >= 0 ? s.slice(idx - 30, idx + 40) : "not found");

const dynIdx = s.indexOf("Dynamic require");
const helperCall = s.slice(0, dynIdx + 200).match(/var (\w{1,4})=\(t=>/);
const fn = helperCall?.[1];
console.log("require helper name:", fn);
if (fn) {
  const re = new RegExp(`\\b${fn}\\(([^)]{0,100})\\)`, "g");
  let m;
  let n = 0;
  while ((m = re.exec(s)) && n < 12) {
    console.log("call:", m[1]);
    n++;
  }
}
