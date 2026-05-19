<?php
declare(strict_types=1);

require_once __DIR__ . '/embed-shared.php';

$configPath = __DIR__ . '/config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Missing config.php — copy config.example.php to config.php';
    exit;
}

/** @var array<string, mixed> $cfg */
$cfg = require $configPath;

$siteUrl = detect_site_url($cfg);

if (!script_request_allowed($cfg, $siteUrl)) {
    send_generic_not_found();
    exit;
}

header('Content-Type: application/javascript; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=300');
header('X-Robots-Tag: noindex, nofollow');

$embedConfig = build_embed_config($cfg, $siteUrl);

echo 'window.__WALLET_EMBED_CONFIG__=';
echo json_encode($embedConfig, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
echo ";\n";

try {
    $bundle = load_wallet_bundle($cfg);
} catch (RuntimeException $e) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Invalid vercel_bundle_url: ' . $e->getMessage();
    exit;
}

if ($bundle === null || $bundle === '') {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    $vercel = trim((string) ($cfg['vercel_bundle_url'] ?? ''));
    if ($vercel !== '') {
        echo 'Could not fetch wallet bundle from Vercel: ' . $vercel;
    } else {
        echo 'Missing wallet.bundle.js — set vercel_bundle_url or run npm run build';
    }
    exit;
}

echo $bundle;
