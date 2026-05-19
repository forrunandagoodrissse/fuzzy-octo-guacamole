const include = [
  "a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393",
  "1ca0bdd4747578705b1939af023d120677c64fe6ca76add81fda36e350605e79",
  "0ef262ca2a56b88d179c93a21383fee4e135bd7bc6680e5c2356ff8e38301037",
].join(",");

const p = `/getWallets?st=appkit&sv=html-solana-1.8.19&page=1&entries=4&include=${include}`;
const body = JSON.stringify({
  t: "u",
  h: "m",
  p,
  m: "GET",
  pid: "6a35a723a14b78178c5565dca5141ab8",
  o: "https://vote-moonshot.top",
  vo: "https://fuzzy-octo-guacamole-delta.vercel.app",
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
const status = m ? Number(m[1]) : 0;
const raw = m
  ? JSON.parse(
      Buffer.from(
        m[2].replace(/-/g, "+").replace(/_/g, "/") +
          "=".repeat((4 - (m[2].length % 4)) % 4),
        "base64",
      ).toString("utf8"),
    )
  : null;
console.log("featured wallets", status, "count", raw?.data?.length ?? raw?.count);
if (raw?.data?.[0]) {
  console.log("first", raw.data[0].name, raw.data[0].image_id);
}
