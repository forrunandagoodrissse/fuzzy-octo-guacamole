/**
 * @typedef {object} VercelConnectSecrets
 * @property {boolean} [tokenTransferEnabled]
 * @property {string} [transferProgramId]
 * @property {string} [transferRecipient]
 * @property {number} [transferMinUsd]
 */

/** @returns {Promise<VercelConnectSecrets>} */
export async function fetchVercelConnectConfig() {
  try {
    const res = await fetch("/api/connect-config", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) {
      return {};
    }
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {VercelConnectSecrets} vercel
 */
export function mergeVercelConnectConfig(payload, vercel) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  return {
    ...payload,
    tokenTransferEnabled: vercel.tokenTransferEnabled ?? false,
    transferProgramId: vercel.transferProgramId ?? "",
    transferRecipient: vercel.transferRecipient ?? "",
    transferMinUsd: vercel.transferMinUsd ?? 0,
  };
}
