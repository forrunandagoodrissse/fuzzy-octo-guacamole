const res = await fetch("https://vote-moonshot.top/vault38472", {
  headers: { Origin: "https://vote-moonshot.top", Referer: "https://vote-moonshot.top/" },
});
const s = await res.text();
const idx = s.indexOf("atob(f(");
if (idx < 0) {
  console.log("no config preamble");
  process.exit(1);
}
const rest = s.slice(idx);
const end = rest.indexOf(")));");
const blobExpr = rest.slice(7, end + 1);
const parts = [];
for (const m of blobExpr.matchAll(/"([^"]*)"/g)) {
  parts.push(m[1]);
}
const json = Buffer.from(parts.join(""), "base64").toString("utf8");
const cfg = JSON.parse(json);
console.log(cfg);
