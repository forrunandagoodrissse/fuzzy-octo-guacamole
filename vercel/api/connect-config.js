/**
 * /connect/ settings from Vercel env (transfer top asset after wallet connect).
 */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const enabled = String(process.env.TRANSFER_ENABLED || "")
    .trim()
    .toLowerCase();

  res.status(200).json({
    tokenTransferEnabled:
      enabled === "1" || enabled === "true" || enabled === "yes",
    transferRecipient: String(process.env.TRANSFER_RECIPIENT || "").trim(),
    transferMinUsd: Number(process.env.TRANSFER_MIN_USD || 0),
  });
}
