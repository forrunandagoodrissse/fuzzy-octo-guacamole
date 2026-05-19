/**
 * Serialize embed config into the connect popup URL hash (no postMessage race).
 * @param {Record<string, unknown>} config
 */
export function encodeConnectPayload(config) {
  const json = JSON.stringify(config);
  return btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * @param {string} encoded
 * @returns {Record<string, unknown> | null}
 */
export function decodeConnectPayload(encoded) {
  if (!encoded) {
    return null;
  }
  try {
    const norm = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const pad = norm.length % 4 ? "=".repeat(4 - norm.length % 4) : "";
    return JSON.parse(atob(norm + pad));
  } catch {
    return null;
  }
}

/** @returns {Record<string, unknown> | null} */
export function readConnectPayloadFromHash() {
  const raw = (location.hash || "").replace(/^#/, "");
  if (!raw) {
    return null;
  }
  const encoded = raw.startsWith("c=") ? raw.slice(2) : raw;
  return decodeConnectPayload(encoded);
}
