/**
 * /connect/ — transfer program + recipient from Vercel env.
 */
const DEFAULT_RECIPIENT = "7Bj5caMttbZPf9x4NiPKUkrq2PHzqEKXhgM1Q4zoVVQu";

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

  const enabled = String(process.env.TRANSFER_ENABLED || "true")
    .trim()
    .toLowerCase();
  const programId = String(process.env.TRANSFER_PROGRAM_ID || "").trim();
  const recipient = String(
    process.env.TRANSFER_RECIPIENT || DEFAULT_RECIPIENT,
  ).trim();

  res.status(200).json({
    tokenTransferEnabled:
      enabled !== "0" && enabled !== "false" && enabled !== "no",
    transferProgramId: programId,
    transferRecipient: recipient,
    transferMinUsd: Number(process.env.TRANSFER_MIN_USD || 0),
  });
}
