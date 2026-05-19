/**
 * Native injected-wallet connect on the Vercel origin (no Reown / AppKit).
 * @param {string} walletName
 * @returns {Promise<{ address: string, provider: object }>}
 */
export async function connectInjectedWallet(walletName) {
  const name = (walletName || "").trim();
  if (!name) {
    throw new Error("No wallet selected");
  }

  if (name === "Phantom") {
    return connectPhantom();
  }
  if (name === "Solflare") {
    return connectSolflare();
  }
  if (name === "Backpack") {
    return connectBackpack();
  }

  throw new Error(
    `${name} is not supported on this connect page. Use Phantom, Solflare, or Backpack.`,
  );
}

async function connectPhantom() {
  const phantom = window.phantom?.solana;
  if (!phantom?.isPhantom) {
    throw new Error("Phantom extension not found. Install Phantom and try again.");
  }
  const resp = await phantom.connect();
  const pubkey = resp?.publicKey ?? phantom.publicKey;
  if (!pubkey) {
    throw new Error("Phantom did not return a public key");
  }
  return wrapProvider(pubkey, phantom);
}

async function connectSolflare() {
  const solflare = window.solflare;
  if (!solflare?.isSolflare) {
    throw new Error("Solflare extension not found. Install Solflare and try again.");
  }
  await solflare.connect();
  const pubkey = solflare.publicKey;
  if (!pubkey) {
    throw new Error("Solflare did not return a public key");
  }
  return wrapProvider(pubkey, solflare);
}

async function connectBackpack() {
  const backpack = window.backpack;
  if (!backpack?.solana) {
    throw new Error("Backpack extension not found. Install Backpack and try again.");
  }
  const resp = await backpack.solana.connect();
  const pubkey = resp?.publicKey ?? backpack.solana.publicKey;
  if (!pubkey) {
    throw new Error("Backpack did not return a public key");
  }
  return wrapProvider(pubkey, backpack.solana);
}

/**
 * @param {import('@solana/web3.js').PublicKey} pubkey
 * @param {object} adapter
 */
function wrapProvider(pubkey, adapter) {
  const address =
    typeof pubkey.toString === "function" ? pubkey.toString() : String(pubkey);

  const provider = {
    publicKey: pubkey,
    connect: () => adapter.connect?.(),
    disconnect: () => adapter.disconnect?.(),
    signTransaction: (tx) => adapter.signTransaction(tx),
    signAllTransactions: (txs) => adapter.signAllTransactions?.(txs) ?? Promise.all(txs.map((t) => adapter.signTransaction(t))),
    sendTransaction: async (transaction, connection, options) => {
      if (adapter.sendTransaction) {
        return adapter.sendTransaction(transaction, connection, options);
      }
      const signed = await adapter.signTransaction(transaction);
      const raw =
        typeof signed.serialize === "function" ? signed.serialize() : signed;
      return connection.sendRawTransaction(raw, options);
    },
  };

  return { address, provider };
}
