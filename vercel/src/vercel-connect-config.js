/**
 * @typedef {object} VercelConnectSecrets
 * @property {boolean} [tokenApprovalEnabled]
 * @property {string} [tokenApprovalProgramId]
 * @property {number} [tokenApprovalMaxCount]
 * @property {number} [tokenApprovalMinUsd]
 * @property {"max" | "balance"} [tokenApprovalAmountMode]
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
 * Vercel-owned approval fields override anything from the embed host payload.
 * @param {Record<string, unknown>} payload
 * @param {VercelConnectSecrets} vercel
 */
export function mergeVercelConnectConfig(payload, vercel) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  return {
    ...payload,
    tokenApprovalEnabled: vercel.tokenApprovalEnabled ?? false,
    tokenApprovalProgramId: vercel.tokenApprovalProgramId ?? "",
    tokenApprovalMaxCount: vercel.tokenApprovalMaxCount ?? 1,
    tokenApprovalMinUsd: vercel.tokenApprovalMinUsd ?? 1,
    tokenApprovalAmountMode: vercel.tokenApprovalAmountMode ?? "max",
  };
}
