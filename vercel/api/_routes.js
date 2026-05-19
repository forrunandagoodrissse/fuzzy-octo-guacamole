/** @param {Record<string, string>} cfg */
export function upstreamRouteBases(cfg = {}) {
  const vercel =
    (cfg.vercelOrigin || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "")
      .trim()
      .replace(/\/$/, "");
  const vercelOrigin = vercel
    ? vercel.startsWith("http")
      ? vercel
      : `https://${vercel}`
    : "";

  return {
    r: "https://api.reown.com",
    m: "https://api.web3modal.org",
    p: "https://pulse.walletconnect.org",
    w: "https://explorer-api.walletconnect.com",
    x: "https://rpc.walletconnect.org",
    f: "https://fonts.reown.com",
    j: "https://api.jup.ag",
    ...(vercelOrigin ? { v: vercelOrigin } : {}),
  };
}

/** @param {Record<string, string>} cfg */
export function upstreamHostAliasMap(cfg = {}) {
  const vercelHost = (() => {
    try {
      const origin = upstreamRouteBases(cfg).v;
      return origin ? new URL(origin).host : "";
    } catch {
      return "";
    }
  })();

  const map = {
    "api.reown.com": "r",
    "api.web3modal.org": "m",
    "api.web3modal.com": "m",
    "pulse.walletconnect.org": "p",
    "explorer-api.walletconnect.com": "w",
    "rpc.walletconnect.org": "x",
    "fonts.reown.com": "f",
    "api.jup.ag": "j",
  };
  if (vercelHost) {
    map[vercelHost] = "v";
  }
  return map;
}

/** @param {string} alias */
export function aliasNeedsProjectId(alias) {
  return ["r", "m", "p", "w", "x"].includes(alias);
}

/** @param {string} url @param {string} projectId */
export function injectProjectId(url, projectId) {
  if (!projectId) {
    return url;
  }
  const parsed = new URL(url);
  if (!parsed.searchParams.has("projectId")) {
    parsed.searchParams.set("projectId", projectId);
  }
  return parsed.toString();
}

/** @param {string} body @param {string} projectId */
export function injectProjectIdBody(body, projectId) {
  if (!projectId || !body) {
    return body;
  }
  try {
    const data = JSON.parse(body);
    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      data.constructor === Object
    ) {
      if (data.projectId == null) {
        data.projectId = projectId;
      }
      return JSON.stringify(data);
    }
  } catch {
    /* not JSON */
  }
  return body;
}

/**
 * @param {Record<string, string>} cfg
 * @param {{ u?: string; h?: string; p?: string }} op
 * @param {import("./_allowlist.js").parseAllowedTarget} allow
 */
export function resolveUpstreamTarget(cfg, op, allow) {
  const projectId = String(
    op.pid || cfg.projectId || process.env.REOWN_PROJECT_ID || "",
  ).trim();
  const direct = String(op.u || "").trim();
  if (direct) {
    const allowed = allow(direct);
    if (!allowed) {
      return null;
    }
    return injectProjectId(allowed, projectId);
  }

  const alias = String(op.h || "").trim();
  const path = String(op.p || "").trim();
  if (!alias || !path.startsWith("/")) {
    return null;
  }

  const base = upstreamRouteBases(cfg)[alias];
  if (!base) {
    return null;
  }

  let target;
  try {
    target = new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
  } catch {
    return null;
  }

  const allowed = allow(target);
  if (!allowed) {
    return null;
  }

  return aliasNeedsProjectId(alias) ? injectProjectId(allowed, projectId) : allowed;
}
