#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

export DEBIAN_FRONTEND=noninteractive
HELIUS_KEY="${HELIUS_KEY:-77abcd46-237f-4705-b85f-40fa6d74dfda}"

if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
fi

apt-get update -qq
apt-get install -y -qq build-essential pkg-config libudev-dev llvm libclang-dev \
  protobuf-compiler libssl-dev curl git

if ! command -v solana >/dev/null 2>&1; then
  curl -sSfL https://release.anza.xyz/stable/install | sh
fi
export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"

if ! command -v rustc >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
source /root/.cargo/env

if ! command -v anchor >/dev/null 2>&1; then
  cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked
fi
export PATH="/root/.cargo/bin:$PATH"

solana --version
anchor --version

if [ ! -f /root/.config/solana/id.json ]; then
  solana-keygen new -o /root/.config/solana/id.json --no-bip39-passphrase -f
fi

solana config set --url "https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}"
echo "Deploy wallet: $(solana address)"
solana balance || true

anchor build
PROGRAM_ID=$(solana address -k target/deploy/vote_delegate-keypair.json)
echo "PROGRAM_ID=${PROGRAM_ID}"

anchor deploy --provider.cluster mainnet

echo "DEPLOYED=${PROGRAM_ID}"
