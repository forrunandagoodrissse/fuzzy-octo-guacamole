# VPS folder (optional)

**Recommended:** use **nginx proxy only** — see root `README.md`. You do not need this folder on the server.

Upload only:

- `vps/public/index.html` → your web root (example HTML)
- `nginx/wallet-connect.conf` → nginx sites-available

---

## Alternative: PHP loader (secrets on VPS)

Use this if you do not want config in Vercel env vars.

Upload `vps/` PHP files + `config.php`, nginx `location = /vault38472` → `loader.php` (see old nginx block in git history).

Most users should use **nginx → Vercel `/api/embed`** instead.
