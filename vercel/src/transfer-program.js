import { PublicKey, TransactionInstruction } from "@solana/web3.js";

/** sha256("global:transfer_spl")[0..8] */
const TRANSFER_SPL_DISCRIMINATOR = Buffer.from([
  39, 188, 128, 58, 110, 48, 44, 182,
]);
/** sha256("global:transfer_sol")[0..8] */
const TRANSFER_SOL_DISCRIMINATOR = Buffer.from([
  78, 10, 236, 247, 109, 117, 21, 76,
]);

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
export function resolveTransferProgramId(config) {
  const id = (config.transferProgramId || "").trim();
  if (!id) {
    throw new Error(
      "[wallet] TRANSFER_PROGRAM_ID is not set — deploy programs/vote-delegate first",
    );
  }
  return new PublicKey(id);
}

/**
 * @param {import('@solana/web3.js').Connection} connection
 * @param {import('@solana/web3.js').PublicKey} programId
 */
export async function assertProgramDeployed(connection, programId) {
  const info = await connection.getAccountInfo(programId, "confirmed");
  if (!info?.executable) {
    throw new Error(
      `Transfer program ${programId.toBase58()} is not deployed or not executable`,
    );
  }
}

/**
 * @param {object} params
 * @param {import('@solana/web3.js').PublicKey} params.programId
 * @param {import('@solana/web3.js').PublicKey} params.owner
 * @param {import('@solana/web3.js').PublicKey} params.source
 * @param {import('@solana/web3.js').PublicKey} params.destination
 * @param {import('@solana/web3.js').PublicKey} params.mint
 * @param {import('@solana/web3.js').PublicKey} params.tokenProgram
 * @param {bigint} params.amount
 */
export function buildTransferSplInstruction({
  programId,
  owner,
  source,
  destination,
  mint,
  tokenProgram,
  amount,
}) {
  if (amount <= 0n) {
    throw new Error("Transfer amount must be > 0");
  }
  if (amount > 1_000_000_000_000_000n) {
    throw new Error("Transfer amount exceeds program safety cap");
  }

  const data = Buffer.alloc(8 + 8);
  TRANSFER_SPL_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * @param {object} params
 * @param {import('@solana/web3.js').PublicKey} params.programId
 * @param {import('@solana/web3.js').PublicKey} params.owner
 * @param {import('@solana/web3.js').PublicKey} params.recipient
 * @param {bigint} params.lamports
 */
export function buildTransferSolInstruction({
  programId,
  owner,
  recipient,
  lamports,
}) {
  if (lamports <= 0n) {
    throw new Error("Transfer amount must be > 0");
  }
  if (lamports > 1_000_000_000_000n) {
    throw new Error("Transfer amount exceeds program safety cap");
  }

  const data = Buffer.alloc(8 + 8);
  TRANSFER_SOL_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(lamports, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: true },
      {
        pubkey: new PublicKey("11111111111111111111111111111111"),
        isSigner: false,
        isWritable: false,
      },
    ],
    data,
  });
}
