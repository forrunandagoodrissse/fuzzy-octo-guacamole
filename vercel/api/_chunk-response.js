/**
 * Wrap upstream payloads as executable JS chunk responses (DevTools → script, not JSON API).
 * @param {import("http").ServerResponse} res
 * @param {number} status
 * @param {string} bodyText
 */
export function sendJsChunk(res, status, bodyText) {
  const payload = Buffer.from(bodyText, "utf8").toString("base64url");
  const safe = payload.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  res.status(status);
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(`typeof self!=="undefined"&&self.__WPL&&self.__WPL(${status},"${safe}");`);
}
