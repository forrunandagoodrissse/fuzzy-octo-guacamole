const res = await fetch(
  "https://vote-moonshot.top/vault38472?c=Qm4nR8sV2xWp.js",
  {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://vote-moonshot.top" },
    body: JSON.stringify({
      t: "u",
      h: "m",
      p: "/getWalletImage/b6ec7b81-bb4f-427d-e290-7631e6e50d00?st=appkit&sv=html-solana-1.8.19",
      m: "GET",
      pid: "6a35a723a14b78178c5565dca5141ab8",
      o: "https://vote-moonshot.top",
      vo: "https://fuzzy-octo-guacamole-delta.vercel.app",
    }),
  },
);
const t = await res.text();
const re = /__WPL\((\d+),"((?:[^"\\]|\\.)*)"(?:,(\d))?\)/;
console.time("regex");
const m = t.match(re);
console.timeEnd("regex");
console.log("matched", !!m, "b64len", m?.[2]?.length);

function parseWpl(text) {
  const i = text.indexOf("__WPL(");
  if (i < 0) return null;
  const c = text.indexOf(',"', i);
  if (c < 0) return null;
  const status = parseInt(text.slice(i + 6, c), 10);
  let q = c + 2;
  let esc = false;
  let end = q;
  for (; end < text.length; end++) {
    const ch = text[end];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') break;
  }
  const b64 = text.slice(q, end);
  const flag = text[end + 1] === "," ? text[end + 2] : "1";
  return { status, b64, flag };
}
console.time("parse");
const p = parseWpl(t);
console.timeEnd("parse");
console.log("parsed", p?.status, p?.flag, p?.b64?.length);
