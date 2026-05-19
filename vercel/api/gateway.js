import { parseAllowedTarget } from "./_allowlist.js";
import { sendJsChunk } from "./_chunk-response.js";

/** @param {import("http").IncomingMessage} req */
function readBody(req) {
  if (typeof req.body === "string") {
    return req.body;
  }
  if (req.body && typeof req.body === "object") {
    if (req.body.jsonrpc) {
      return JSON.stringify(req.body);
    }
    return JSON.stringify(req.body);
  }
  return "";
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
    res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("HELIUS_RPC_URL not configured");
    return;
  }

  const upstreamRes = await fetch(upstream, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const text = await upstreamRes.text();
  sendJsChunk(res, upstreamRes.status, text);
}

/** @param {string} ids */
async function handlePrice(ids, res) {
  if (!ids || !/^[A-Za-z0-9:,_-]+$/.test(ids)) {
    res.status(400).end();
    return;
  }
  const upstream = `https://api.jup.ag/price/v2?ids=${encodeURIComponent(ids)}`;
  const upstreamRes = await fetch(upstream, { method: "GET" });
  const text = await upstreamRes.text();
  sendJsChunk(res, upstreamRes.status, text);
}

/** @param {{ m?: string; u?: string; b?: string }} op */
async function handleUpstream(op, res) {
  const target = parseAllowedTarget(String(op.u || ""));
  if (!target) {
    res.status(op.u ? 403 : 400).end();
    return;
  }
  const method = (op.m || "GET").toUpperCase();
  const headers = {};
  let body;
  if (method !== "GET" && method !== "HEAD" && op.b != null && op.b !== "") {
    body = op.b;
    headers["Content-Type"] = "application/json";
  }

  const upstreamRes = await fetch(target, { method, headers, body });
  const text = await upstreamRes.text();
  sendJsChunk(res, upstreamRes.status, text);
}

/** @param {unknown} op */
async function dispatchOp(op, res) {
  if (!op || typeof op !== "object") {
    res.status(400).end();
    return;
  }
  const env = /** @type {{ t?: string; i?: string; m?: string; u?: string; b?: string }} */ (op);
  if (env.t === "p") {
    await handlePrice(String(env.i || ""), res);
    return;
  }
  if (env.t === "u") {
    await handleUpstream(env, res);
    return;
  }
  res.status(400).end();
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const raw = String(req.query.d || "");
    if (!raw) {
      res.status(405).end();
      return;
    }
    let decoded;
    try {
      decoded = Buffer.from(raw, "base64url").toString("utf8");
    } catch {
      try {
        decoded = Buffer.from(raw, "base64").toString("utf8");
      } catch {
        res.status(400).end();
        return;
      }
    }
    await dispatchOp(parseEnvelope(decoded), res);
    return;
  }

  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const raw = readBody(req);
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
    await handleUpstream(parsed, res);
    return;
  }

  res.status(400).end();
}
