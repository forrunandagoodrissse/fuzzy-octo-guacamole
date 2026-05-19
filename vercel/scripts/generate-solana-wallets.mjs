/**
 * Builds wallet lists from your curated grid (WalletGuide names).
 * Uses reown_project_id from vps/config.php only — never a hardcoded foreign projectId.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";

/** Order from your wallet grid; MetaMask is moved to the end automatically */
const CURATED_GRID_NAMES = [
  "Ledger Wallet",
  "Phantom",
  "Solflare",
  "Jupiter",
  "MetaMask",
  "Backpack",
  "Trust Wallet",
  "Ctrl Wallet",
  "HOT Wallet",
  "Zerion",
  "Base (formerly Coinbase Wallet)",
  "Bitget Wallet",
  "Bybit Wallet",
  "TokenPocket",
  "Glow",
  "OKX Wallet",
  "Magic Eden",
  "MathWallet",
  "Exodus",
  "Anchorage Digital",
  "Bron",
  "GK8",
  "SOC Wallet",
  "Tobi",
  "ECOIN Wallet",
  "Oblio Wallet",
  "Blanq",
  "W3 Wallet",
  "T+ Wallet",
  "DaffiOne",
  "Squirrel Wallet",
  "UP.io",
  "Nest Wallet",
  "NewWallet",
  "QubeticsWallet",
  "Plena-App",
  "Gridlock Wallet",
  "Venly",
  "Dokwallet",
  "VGX Wallet",
  "Flash Wallet",
  "CoinEx Wallet",
  "Crossmint",
  "tastycrypto",
  "Zypto",
  "MaxWallet",
  "Rezor",
  "Cogni",
];

const NAME_ALIASES = {
  BackPack: "Backpack",
  Trust: "Trust Wallet",
  Ctrl: "Ctrl Wallet",
  Base: "Base (formerly Coinbase Wallet)",
  Bitget: "Bitget Wallet",
  ByBit: "Bybit Wallet",
  "Bybit Wallet": "Bybit Wallet",
  OKX: "OKX Wallet",
  MagicEden: "Magic Eden",
  "Math Wallet": "MathWallet",
};

const FEATURED_NAMES = ["Phantom", "Solflare", "Jupiter"];
const LAST_NAMES = ["MetaMask"];

function readProjectIdFromConfig() {
  for (const file of [
    "../vps/config.php",
    "../vps/config.example.php",
    "vps/config.php",
    "vps/config.example.php",
  ]) {
    if (!existsSync(file)) continue;
    const m = readFileSync(file, "utf8").match(
      /['"]reown_project_id['"]\s*=>\s*['"]([^'"]+)['"]/
    );
    if (m && m[1] !== "YOUR_REOWN_PROJECT_ID") return m[1];
  }
  return null;
}

function resolveName(target, listings) {
  const canonical = NAME_ALIASES[target] || target;
  const all = Object.values(listings);

  const exact = all.find(
    (w) => w.name === canonical || w.name === target
  );
  if (exact) return exact;

  const lower = canonical.toLowerCase();
  return all.find((w) => {
    const n = (w.name || "").toLowerCase();
    return n === lower || n.startsWith(lower) || lower.startsWith(n);
  });
}

const projectId =
  process.argv[2] || process.env.REOWN_PROJECT_ID || readProjectIdFromConfig();
if (!projectId) {
  console.error(
    "Set reown_project_id in vps/config.php or run:\n  node scripts/generate-solana-wallets.mjs YOUR_PROJECT_ID"
  );
  process.exit(1);
}

const res = await fetch(
  `https://explorer-api.walletconnect.com/v3/wallets?projectId=${encodeURIComponent(projectId)}`
);
const data = await res.json();
if (!data.listings) {
  console.error("API error:", JSON.stringify(data).slice(0, 300));
  process.exit(1);
}

const { listings } = data;
const include = [];
const missing = [];

for (const name of CURATED_GRID_NAMES) {
  if (name === "MetaMask") continue;
  const wallet = resolveName(name, listings);
  if (!wallet) {
    missing.push(name);
    continue;
  }
  if (!include.includes(wallet.id)) include.push(wallet.id);
}

for (const name of LAST_NAMES) {
  const wallet = resolveName(name, listings);
  if (wallet && !include.includes(wallet.id)) include.push(wallet.id);
  else if (!wallet) missing.push(name);
}

const featured = FEATURED_NAMES.map((n) => resolveName(n, listings)?.id).filter(
  Boolean
);

if (missing.length) {
  console.warn("Not found in WalletGuide for your projectId:", missing.join(", "));
}

const out = `/* AUTO-GENERATED — npm run generate:wallets */
/* Curated grid wallets; projectId from vps/config.php only */

export const FEATURED_WALLET_IDS = ${JSON.stringify(featured, null, 2)};

export const INCLUDE_WALLET_IDS = ${JSON.stringify(include, null, 2)};
`;

writeFileSync("src/solana-wallets.js", out);
console.log(
  `Wrote src/solana-wallets.js (${include.length} wallets, projectId ${projectId.slice(0, 8)}…)`
);
