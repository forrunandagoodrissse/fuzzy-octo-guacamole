/** @param {string} host */
export function upstreamHostAllowed(host) {
  const h = host.toLowerCase();
  const suffixes = [
    "walletconnect.org",
    "walletconnect.com",
    "web3modal.org",
    "web3modal.com",
    "reown.com",
    "jup.ag",
    "helius-rpc.com",
    "googleapis.com",
    "gstatic.com",
    "vercel.app",
  ];
  return suffixes.some(
    (suffix) => h === suffix || h.endsWith("." + suffix),
  );
}

/** @param {string} target */
export function parseAllowedTarget(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  if (!upstreamHostAllowed(url.host)) {
    return null;
  }
  return url.toString();
}
