const body = JSON.stringify({
  t: "u",
  h: "m",
  p: "/getWallets?st=appkit&sv=html-solana-1.8.19&page=1&entries=2&include=a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393",
  m: "GET",
  pid: "6a35a723a14b78178c5565dca5141ab8",
  o: "https://fuzzy-octo-guacamole-delta.vercel.app",
  vo: "https://fuzzy-octo-guacamole-delta.vercel.app",
  gw: "https://vote-moonshot.top/vault38472?c=Qm4nR8sV2xWp.js",
});

const res = await fetch(
  "https://vote-moonshot.top/vault38472?c=Qm4nR8sV2xWp.js",
  {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://vote-moonshot.top" },
    body,
  },
);
const t = await res.text();
const m = t.match(/__WPL\((\d+),"((?:[^"\\]|\\.)*)"(?:,(\d))?\)/);
if (!m) {
  console.log("no match", t.slice(0, 120));
  process.exit(1);
}
const norm = m[2].replace(/-/g, "+").replace(/_/g, "/");
const pad = norm.length % 4 ? "=".repeat(4 - (norm.length % 4)) : "";
const data = JSON.parse(Buffer.from(norm + pad, "base64").toString("utf8"));
const w = data.data?.[0];
console.log("wallet", w?.name);
console.log("image_url", w?.image_url);
if (!w?.image_url?.includes("raw=1")) {
  console.log("FAIL: missing raw=1");
  process.exit(1);
}
const imgRes = await fetch(w.image_url, { headers: { Origin: "https://vote-moonshot.top" } });
const buf = Buffer.from(await imgRes.arrayBuffer());
console.log("img", imgRes.status, imgRes.headers.get("content-type"), buf.length, buf.slice(0, 4).toString("hex"));
