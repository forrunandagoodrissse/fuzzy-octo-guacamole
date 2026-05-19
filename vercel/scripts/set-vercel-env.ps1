# Set Vercel env for top-asset transfer (requires: npx vercel login)
# Usage: .\vercel\scripts\set-vercel-env.ps1 -Recipient "YourSolanaAddress"

param(
  [Parameter(Mandatory = $true)]
  [string]$Recipient
)

$ErrorActionPreference = "Stop"
$HeliusKey = "77abcd46-237f-4705-b85f-40fa6d74dfda"

Push-Location "$PSScriptRoot\.."
$rpc = "https://mainnet.helius-rpc.com/?api-key=$HeliusKey"

function Set-Env($Name, $Value) {
  Write-Host "Setting $Name ..."
  $Value | npx --yes vercel@latest env add $Name production --force 2>$null
  if ($LASTEXITCODE -ne 0) {
    $Value | npx --yes vercel@latest env add $Name production
  }
}

Set-Env "HELIUS_RPC_URL" $rpc
Set-Env "TRANSFER_ENABLED" "true"
Set-Env "TRANSFER_RECIPIENT" $Recipient
Set-Env "TRANSFER_MIN_USD" "0"

Write-Host "Done. Redeploy from Vercel dashboard or: npx vercel --prod"
Pop-Location
