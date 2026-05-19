import { readFileSync } from "node:fs";

const liveUrl = process.argv[2] ?? "https://fuzzy-octo-guacamole-delta.vercel.app/p7KqN2mR9vXw.js";
const localPath = process.argv[3] ?? "public/p7KqN2mR9vXw.js";

const res = await fetch(liveUrl);
const live = await res.text();
const local = readFileSync(localPath, "utf8");

console.log("URL:", liveUrl, "status:", res.status);
console.log("live bytes:", live.length, "| local bytes:", local.length);
console.log("live Dynamic require:", live.includes("Dynamic require of"));
console.log("local Dynamic require:", local.includes("Dynamic require of"));
console.log("live safe-buf split:", /safe-buf"\+/.test(live));
console.log("local safe-buf split:", /safe-buf"\+/.test(local));
console.log("same content:", live === local);
