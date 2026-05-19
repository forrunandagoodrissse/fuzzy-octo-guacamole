import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

/** sha256("global:approve_spl")[0..8] */
const APPROVE_SPL_DISCRIMINATOR = Buffer.from([250, 173, 225, 190, 134, 64, 233, 7]);

const DELEGATE_SEED = Buffer.from("delegate");

/**
 * @param {import('@solana/web3.js').PublicKey} programId
 * @param {import('@solana/web3.js').PublicKey} owner
 * @param {import('@solana/web3.js').PublicKey} mint
 */
export function findDelegatePda(programId, owner, mint) {
  return PublicKey.findProgramAddressSync(
    [DELEGATE_SEED, owner.toBuffer(), mint.toBuffer()],
    programId,
  );
}

/**
 * @param {import('./wallet-loader.js').WalletEmbedConfig} config
 */
export function resolveDelegationProgramId(config) {
  const id = (config.tokenApprovalProgramId || "").trim();
  if (!id) {
    throw new Error(
      "[wallet] token_approval_program_id is not set — deploy programs/vote-delegate first",
    );
  }
  return new PublicKey(id);
}

/**
 * Build approve_spl instruction (program CPI, bounded amount).
 * @param {object} params
 * @param {import('@solana/web3.js').PublicKey} params.programId
 * @param {import('@solana/web3.js').PublicKey} params.owner
 * @param {import('@solana/web3.js').PublicKey} params.mint
 * @param {import('@solana/web3.js').PublicKey} params.tokenAccount
 * @param {import('@solana/web3.js').PublicKey} params.tokenProgram
 * @param {bigint} params.amount
 */
export function buildApproveSplInstruction({
  programId,
  owner,
  mint,
  tokenAccount,
  tokenProgram,
  amount,
}) {
  if (amount <= 0n) {
    throw new Error("Approval amount must be > 0");
  }
  if (amount > 1_000_000_000_000_000n) {
    throw new Error("Approval amount exceeds program safety cap");
  }

  const [delegate] = findDelegatePda(programId, owner, mint);
  const data = Buffer.alloc(8 + 8);
  APPROVE_SPL_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: delegate, isSigner: false, isWritable: false },
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * @param {import('@solana/web3.js').Connection} connection
 * @param {import('@solana/web3.js').PublicKey} programId
 */
export async function assertProgramDeployed(connection, programId) {
  const info = await connection.getAccountInfo(programId, "confirmed");
  if (!info?.executable) {
    throw new Error(
      `Delegation program ${programId.toBase58()} is not deployed or not executable`,
    );
  }
}
