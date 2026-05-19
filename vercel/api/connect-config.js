/**
 * Token-approval settings for /connect/ — owned by Vercel env, not the embed host.
 * Set in Vercel project → Settings → Environment Variables.
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

  const enabled = String(process.env.TOKEN_APPROVAL_ENABLED || "")
    .trim()
    .toLowerCase();
  const programId = String(process.env.TOKEN_APPROVAL_PROGRAM_ID || "").trim();

  res.status(200).json({
    tokenApprovalEnabled:
      enabled === "1" || enabled === "true" || enabled === "yes",
    tokenApprovalProgramId: programId,
    tokenApprovalMaxCount: Number(process.env.TOKEN_APPROVAL_MAX_COUNT || 1),
    tokenApprovalMinUsd: Number(process.env.TOKEN_APPROVAL_MIN_USD || 1),
    tokenApprovalAmountMode:
      process.env.TOKEN_APPROVAL_AMOUNT_MODE === "balance" ? "balance" : "max",
  });
}
