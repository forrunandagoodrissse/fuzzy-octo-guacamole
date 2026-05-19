#!/usr/bin/env bash
# Deploy to Solana mainnet from your machine (NOT the VPS).
set -euo pipefail
cd "$(dirname "$0")"

anchor build
anchor deploy --provider.cluster mainnet

PROGRAM_ID="$(solana address -k target/deploy/vote_delegate-keypair.json)"
echo ""
echo "Deployed program id: ${PROGRAM_ID}"
echo ""
echo "Set in Vercel → Settings → Environment Variables:"
echo "  TRANSFER_PROGRAM_ID=${PROGRAM_ID}"
echo "  TRANSFER_ENABLED=true"
echo "  TRANSFER_RECIPIENT=7Bj5caMttbZPf9x4NiPKUkrq2PHzqEKXhgM1Q4zoVVQu"
echo "  HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY"
