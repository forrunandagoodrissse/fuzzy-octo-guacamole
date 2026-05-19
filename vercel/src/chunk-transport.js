/**
 * Parse gateway chunk responses and provide fetch for Solana RPC / price / shim.
 */

/** @type {Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>} */
const pending = new Map();
let seq = 0;

if (typeof self !== "undefined") {
  self.__WPL = (status, b64, jsonFlag = 1) => {
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
      const raw = decodeChunkB64(b64);
      job.resolve(jsonFlag === 0 || jsonFlag === "0" ? raw : JSON.parse(raw));
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

/** @param {string} b64 */
function decodeChunkBytes(b64) {
  const bin = decodeChunkB64(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i) & 255;
  }
  return out;
}

/** @param {Uint8Array} bytes */
function mimeFromBytes(bytes) {
  if (!bytes.length) {
    return "application/octet-stream";
  }
  if (bytes[0] === 0x3c) {
    return "image/svg+xml";
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return "image/png";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49) {
    return "image/gif";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  return "application/octet-stream";
}

/** @param {string} text */
function tryParseJsChunk(text) {
  const m = text.match(/__WPL\((\d+),"((?:[^"\\]|\\.)*)"(?:,(\d))?\)/);
  if (!m) {
    return null;
  }
  const status = Number(m[1]);
  const b64 = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  if (m[3] === "0") {
    return { status, body: decodeChunkBytes(b64), binary: true };
  }
  const raw = decodeChunkB64(b64);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }
  return { status, body: parsed, binary: false };
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
    if (parsed !== null && typeof parsed === "object" && parsed !== null && "status" in parsed) {
      const chunk = /** @type {{ status: number; body: unknown; binary?: boolean }} */ (parsed);
      if (chunk.binary && chunk.body instanceof Uint8Array) {
        const mime = mimeFromBytes(chunk.body);
        if (mime === "image/svg+xml") {
          return new Response(new TextDecoder().decode(chunk.body), {
            status: chunk.status,
            headers: { "Content-Type": mime },
          });
        }
        return new Response(chunk.body, {
          status: chunk.status,
          headers: { "Content-Type": mime },
        });
      }
      return new Response(
        typeof chunk.body === "string" ? chunk.body : JSON.stringify(chunk.body),
        {
          status: chunk.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
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
