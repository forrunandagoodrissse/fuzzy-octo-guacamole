/**
 * Parse gateway chunk responses and provide fetch for Solana RPC / price / shim.
 */

/** @type {Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>} */
const pending = new Map();
let seq = 0;

if (typeof self !== "undefined") {
  self.__WPL = (status, b64) => {
    const id = self.__WPL_ID;
    delete self.__WPL_ID;
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    if (status < 200 || status >= 300) {
      job.reject(new Error(`chunk gateway ${status}`));
      return;
    }
    try {
      const json = JSON.parse(decodeChunkB64(b64));
      job.resolve(json);
    } catch (err) {
      job.reject(err instanceof Error ? err : new Error(String(err)));
    }
  };
}

/** @param {string} b64 */
function decodeChunkB64(b64) {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 ? "=".repeat(4 - (norm.length % 4)) : "";
  return atob(norm + pad);
}

/** @param {string} text */
function tryParseJsChunk(text) {
  const m = text.match(/__WPL\((\d+),"((?:[^"\\]|\\.)*)"\)/);
  if (!m) {
    return null;
  }
  const status = Number(m[1]);
  const b64 = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  if (status < 200 || status >= 300) {
    throw new Error(`chunk gateway ${status}`);
  }
  return JSON.parse(decodeChunkB64(b64));
}

/**
 * @param {string} gatewayUrl
 * @param {RequestInfo | URL} info
 * @param {RequestInit} [init]
 */
export async function gatewayFetch(gatewayUrl, info, init) {
  const res = await fetch(info, init);
  const text = await res.text();
  let data;
  try {
    const parsed = tryParseJsChunk(text);
    data = parsed ?? JSON.parse(text);
  } catch {
    return new Response(text, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  }
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Load a GET gateway op via <script> (shows as JS in Network).
 * @param {string} scriptUrl
 */
export function loadGatewayScript(scriptUrl) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    self.__WPL_ID = id;
    const el = document.createElement("script");
    el.src = scriptUrl;
    el.async = true;
    el.onload = () => {
      el.remove();
    };
    el.onerror = () => {
      pending.delete(id);
      reject(new Error("chunk script failed"));
      el.remove();
    };
    document.head.appendChild(el);
    window.setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error("chunk script timeout"));
      }
    }, 60000);
  });
}

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
export function chunkUrl(config, name) {
  const base = (config.chunkBase || "").replace(/\/$/, "");
  return `${base}?c=${encodeURIComponent(name)}`;
}

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
export function importSplitChunk(config, name) {
  return import(/* @vite-ignore */ chunkUrl(config, name));
}
