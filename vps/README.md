# VPS — PHP proxy

The HTML site loads **`/vault38472`** (or `/vault38472.php`). nginx runs **`loader.php`**, which:

1. Reads **`config.php`** (your secrets)
2. Outputs `window.__WALLET_EMBED_CONFIG__`
3. Fetches **`wallet.bundle.js`** from Vercel (cached in `cache/`)

## Files on the server

| File | You edit? |
|------|-----------|
| `config.php` | Yes — once |
| `loader.php` | Upload once |
| `embed-shared.php` | Upload once |
| `public/*.html` | Yes — your pages |

## config.php minimum

```php
'vercel_bundle_url' => 'https://YOUR-PROJECT.vercel.app/wallet.bundle.js',
'site_url' => 'https://vote-moonshot.top',
'button_class' => 'K7mQ2',
'reown_project_id' => '...',
```

See root **README.md** for full setup.
