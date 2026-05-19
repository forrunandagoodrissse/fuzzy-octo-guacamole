/**
 * Vercel /connect/ — full AppKit + Phantom on the Vercel origin.
 */
import { initConnectHost } from "./wallet-loader.js";
import { readConnectPayloadFromHash } from "./connect-launch.js";

/** @param {import('./wallet-loader.js').WalletEmbedConfig} cfg */
function configForVercelHost(cfg) {
  const origin = location.origin.replace(/\/$/, "");
  const gateway = (cfg.gatewayChunk || "Qm4nR8sV2xWp.js").replace(/^\//, "");
  const gatewayUrl = `${origin}/${gateway}`;
  const approvalChunk =
    (cfg.splitChunks || [])[0] || "chunks/H7kL9mN2pQx.js";

  return {
    ...cfg,
    siteUrl: (cfg.siteUrl || origin).replace(/\/$/, ""),
    siteIcons: cfg.siteIcons?.length
      ? cfg.siteIcons
      : [`${origin}/tYZq2BsVawvS5wYEF.svg`],
    chunkBase: origin,
    gatewayChunk: gateway,
    solanaRpcUrl: gatewayUrl,
    priceApiUrl: gatewayUrl,
    connectPopupEnabled: false,
    connectViaVercel: false,
    approvalChunkUrl: `${origin}/${approvalChunk.replace(/^\//, "")}`,
  };
}

function boot() {
  /** @type {boolean} */
  let started = false;

  /** @param {import('./wallet-loader.js').WalletEmbedConfig} raw */
  const start = (raw) => {
    if (started || !raw?.projectId) {
      return;
    }
    started = true;
    initConnectHost(configForVercelHost(raw));
  };

  const fromHash = readConnectPayloadFromHash();
  if (fromHash?.projectId) {
    start(fromHash);
  }

  window.addEventListener("message", (event) => {
    if (event.data?.type !== "wallet-connect-config") {
      return;
    }
    const cfg = event.data.config;
    const parentOrigin = String(cfg?.parentOrigin || "").trim();
    if (parentOrigin && event.origin !== parentOrigin) {
      return;
    }
    start(cfg);
  });

  function signalReady() {
    if (!window.opener || window.opener.closed) {
      return;
    }
    try {
      window.opener.postMessage({ type: "wallet-connect-host-ready" }, "*");
    } catch {
      /* ignore */
    }
  }

  if (!started) {
    signalReady();
    window.setInterval(signalReady, 400);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
