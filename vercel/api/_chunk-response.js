/**
 * @param {string} contentType
 * @param {string | Buffer} bodyText
 */
export function upstreamBodyAsJson(contentType, bodyText) {
  const sample =
    typeof bodyText === "string" ? bodyText : bodyText.toString("utf8", 0, 64);
  const type = (contentType || "").split(";")[0].trim().toLowerCase();
  if (type) {
    if (type.startsWith("image/")) {
      return false;
    }
    if (type.includes("svg")) {
      return false;
    }
    if (type.includes("octet-stream")) {
      return false;
    }
    if (type.includes("font")) {
      return false;
    }
    if (type.includes("json")) {
      return true;
    }
    if (type === "text/plain" || type === "text/html") {
      return true;
    }
    return false;
  }
  const start = sample.trimStart();
  return start.length > 0 && (start[0] === "{" || start[0] === "[");
}

/**
 * Wrap upstream payloads as executable JS chunk responses (DevTools → script, not JSON API).
 * @param {import("http").ServerResponse} res
 * @param {number} status
 * @param {string | Buffer} bodyText
 */
export function sendJsChunk(res, status, bodyText, asJson = true) {
  const payload = (
    asJson
      ? Buffer.from(String(bodyText), "utf8")
      : Buffer.isBuffer(bodyText)
        ? bodyText
        : Buffer.from(String(bodyText), "latin1")
  ).toString("base64url");
  const safe = payload.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const flag = asJson ? "1" : "0";
  res.status(200);
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    `typeof self!=="undefined"&&self.__WPL&&self.__WPL(${status},"${safe}",${flag});`,
  );
}
