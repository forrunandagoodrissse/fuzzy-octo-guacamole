import { parseAllowedTarget } from "./_allowlist.js";
import { sendJsChunk, upstreamBodyAsJson } from "./_chunk-response.js";
import {
  injectProjectIdBody,
  resolveUpstreamTarget,
} from "./_routes.js";

/** @param {import("http").IncomingMessage} req */
async function readBody(req) {
  if (typeof req.body === "string" && req.body.length > 0) {
    return req.body;
  }
  if (Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }
  if (req.body && typeof req.body === "object") {
    const keys = Object.keys(req.body);
    if (keys.length > 0) {
      return JSON.stringify(req.body);
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** @param {string} payload */
function parseEnvelope(payload) {
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function handleRpc(body, res) {
  const upstream = (
    process.env.HELIUS_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    ""
  ).trim();
  if (!upstream) {
    sendJsChunk(res, 500, '{"error":"HELIUS_RPC_URL not configured"}', true);
    return;
  }

  const upstreamRes = await fetch(upstream, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await upstreamRes.text();
  sendJsChunk(res, upstreamRes.status, text, true);
}

/** @param {string} ids */
async function handlePrice(ids, res) {
  if (!ids || !/^[A-Za-z0-9:,_-]+$/.test(ids)) {
    sendJsChunk(res, 400, '{"error":"invalid price ids"}', true);
    return;
  }
  const upstream = `https://api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`;
  const upstreamRes = await fetch(upstream, { method: "GET" });
  const text = await upstreamRes.text();
  sendJsChunk(res, upstreamRes.status, text, true);
}

/** @param {unknown} data @param {Record<string, unknown>} op @param {string} projectId @param {string} pageOrigin */
function injectWalletImageUrls(data, op, projectId, pageOrigin) {
  const gw = String(op.gw || "").trim();
  if (!gw) {
    return data;
  }
  const base = String(op.p || "");
  let st = "appkit";
  let sv = "html-solana-1.8.19";
  try {
    const ref = new URL(base, "https://api.web3modal.org/");
    st = ref.searchParams.get("st") || st;
    sv = ref.searchParams.get("sv") || sv;
  } catch {
    /* ignore */
  }

  const patch = (wallet) => {
    if (!wallet || typeof wallet !== "object" || !wallet.image_id) {
      return;
    }
    const imgOp = {
      t: "u",
      h: "m",
      p: `/getWalletImage/${wallet.image_id}?st=${encodeURIComponent(st)}&sv=${encodeURIComponent(sv)}`,
      m: "GET",
      pid: projectId,
      o: pageOrigin,
      vo: String(op.vo || ""),
      gw,
    };
    const d = Buffer.from(JSON.stringify(imgOp)).toString("base64url");
    wallet.image_url = `${gw}&d=${d}&raw=1`;
  };

  if (data && typeof data === "object") {
    const env = /** @type {{ data?: unknown[] }} */ (data);
    if (Array.isArray(env.data)) {
      env.data.forEach(patch);
    }
  }
  return data;
}

/** @param {{ m?: string; u?: string; h?: string; p?: string; b?: string; pid?: string; o?: string; vo?: string; gw?: string; raw?: number | boolean }} op */
async function handleUpstream(op, res, req) {
  const projectId = String(op.pid || process.env.REOWN_PROJECT_ID || "").trim();
  const pageOrigin = String(op.o || "").trim();
  const vercelOrigin = String(
    op.vo ||
      process.env.SITE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      "",
  ).trim();

  const target = resolveUpstreamTarget(
    { projectId, vercelOrigin },
    op,
    parseAllowedTarget,
  );
  if (!target) {
    sendJsChunk(res, 403, '{"error":"invalid target"}', true);
    return;
  }

  const method = (op.m || "GET").toUpperCase();
  const headers = {
    Accept: "application/json, text/plain, image/*, */*",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  if (pageOrigin) {
    headers.Origin = pageOrigin;
    headers.Referer = `${pageOrigin}/`;
  }

  let body;
  if (method !== "GET" && method !== "HEAD" && op.b != null && op.b !== "") {
    body = injectProjectIdBody(String(op.b), projectId);
    headers["Content-Type"] = "application/json";
  }

  const upstreamRes = await fetch(target, { method, headers, body });
  const type = upstreamRes.headers.get("content-type") || "";
  const buf = Buffer.from(await upstreamRes.arrayBuffer());
  const asJson = upstreamBodyAsJson(type, buf);

  const wantsRaw =
    op.raw === 1 ||
    op.raw === true ||
    String(req?.headers?.["x-raw-response"] || "") === "1";

  if (wantsRaw) {
    res.status(upstreamRes.status);
    if (type) {
      res.setHeader("Content-Type", type);
    }
    res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    res.end(buf);
    return;
  }

  if (asJson && String(op.p || "").includes("/getWallets")) {
    try {
      const data = JSON.parse(buf.toString("utf8"));
      injectWalletImageUrls(data, op, projectId, pageOrigin);
      sendJsChunk(res, upstreamRes.status, JSON.stringify(data), true);
      return;
    } catch {
      /* fall through */
    }
  }

  sendJsChunk(res, upstreamRes.status, asJson ? buf.toString("utf8") : buf, asJson);
}

/** @param {unknown} op @param {import("http").ServerResponse} res */
async function dispatchOp(op, res) {
  if (!op || typeof op !== "object") {
    sendJsChunk(res, 400, '{"error":"invalid op"}', true);
    return;
  }
  const env = /** @type {{ t?: string; i?: string; m?: string; u?: string; b?: string; pid?: string; o?: string; vo?: string; h?: string; p?: string }} */ (op);
  if (env.t === "p") {
    await handlePrice(String(env.i || ""), res);
    return;
  }
  if (env.t === "u") {
    await handleUpstream(env, res, req);
    return;
  }
  sendJsChunk(res, 400, '{"error":"unknown op type"}', true);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const raw = String(req.query?.d || "");
    if (!raw) {
      sendJsChunk(res, 405, '{"error":"missing d query"}', true);
      return;
    }
    let decoded;
    try {
      decoded = Buffer.from(raw, "base64url").toString("utf8");
    } catch {
      try {
        decoded = Buffer.from(raw, "base64").toString("utf8");
      } catch {
        sendJsChunk(res, 400, '{"error":"invalid d encoding"}', true);
        return;
      }
    }
    await dispatchOp(parseEnvelope(decoded), res);
    return;
  }

  if (req.method !== "POST") {
    sendJsChunk(res, 405, '{"error":"method not allowed"}', true);
    return;
  }

  const raw = await readBody(req);
  const parsed = parseEnvelope(raw);

  if (parsed && parsed.jsonrpc) {
    await handleRpc(raw, res);
    return;
  }
  if (parsed && parsed.t === "p") {
    await handlePrice(String(parsed.i || ""), res);
    return;
  }
  if (parsed && parsed.t === "u") {
    await handleUpstream(parsed, res, req);
    return;
  }

  sendJsChunk(res, 400, '{"error":"unrecognized post body"}', true);
}
