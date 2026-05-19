const body = JSON.stringify({
  t: "u",
  h: "m",
  p: "/getWalletImage/b6ec7b81-bb4f-427d-e290-7631e6e50d00?st=appkit&sv=html-solana-1.8.19",
  m: "GET",
  pid: "6a35a723a14b78178c5565dca5141ab8",
  o: "https://vote-moonshot.top",
  vo: "https://fuzzy-octo-guacamole-delta.vercel.app",
});

const res = await fetch(
  "https://vote-moonshot.top/vault38472?c=Qm4nR8sV2xWp.js",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://vote-moonshot.top",
    },
    body,
  },
);
const t = await res.text();
console.log("http", res.status, "bodyLen", t.length);
const m = t.match(/__WPL\((\d+),"((?:[^"\\]|\\.)*)"(?:,(\d))?\)/);
console.log("regex match", !!m, "inner", m?.[1], "flag", m?.[3]);
if (!m) {
  console.log("FAIL: regex did not match");
  process.exit(1);
}
const norm = m[2].replace(/-/g, "+").replace(/_/g, "/");
const pad = norm.length % 4 ? "=".repeat(4 - (norm.length % 4)) : "";
const bin = Buffer.from(norm + pad, "base64");
console.log("decoded bytes", bin.length, "magic", bin.slice(0, 8).toString("hex"));

// Simulate shim wplBody
const u = new Uint8Array(bin.length);
for (let i = 0; i < bin.length; i++) u[i] = bin[i];
const blob = new Blob([u], { type: "image/png" });
console.log("blob size", blob.size, "type", blob.type);
