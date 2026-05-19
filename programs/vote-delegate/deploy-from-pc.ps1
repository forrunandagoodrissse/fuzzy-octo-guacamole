# Build + deploy vote-delegate from this PC.
# Needs: ~3 SOL on deploy wallet, and ONE-TIME admin for platform-tools (or VS Build Tools).
#
# Usage (PowerShell):
#   cd programs\vote-delegate
#   .\deploy-from-pc.ps1

$ErrorActionPreference = "Stop"
$env:HOME = $env:USERPROFILE
$SolBin = "$env:USERPROFILE\.local\share\solana\solana-release\bin"
$env:Path = "$SolBin;$env:USERPROFILE\.cargo\bin;" + $env:Path

$HeliusKey = "77abcd46-237f-4705-b85f-40fa6d74dfda"
$ProgramId = "8a1coha6ryB3iXQxjBBEXNRGhMhi8u9xTnnGLLuzghEM"
$Recipient = "7Bj5caMttbZPf9x4NiPKUkrq2PHzqEKXhgM1Q4zoVVQu"

Set-Location $PSScriptRoot

if (-not (Test-Path $SolBin\solana.exe)) {
  Write-Host "Solana not installed. Run from repo root setup or download:"
  Write-Host "https://github.com/anza-xyz/agave/releases"
  exit 1
}

$solDir = "$env:USERPROFILE\.config\solana"
if (-not (Test-Path "$solDir\id.json")) {
  solana-keygen new -o "$solDir\id.json" --no-bip39-passphrase -f
}

solana config set --url "https://mainnet.helius-rpc.com/?api-key=$HeliusKey"
Write-Host "Deploy wallet: $(solana address)"
Write-Host "Balance: $(solana balance)"
Write-Host "Program id: $ProgramId"
Write-Host ""

Write-Host "Building BPF (if this fails, run PowerShell as Administrator once)..."
cargo-build-sbf --manifest-path programs/vote-delegate/Cargo.toml

if (-not (Test-Path "target\deploy\vote_delegate.so")) {
  Write-Host "Build failed. You can also download vote_delegate.so from GitHub Actions artifact."
  exit 1
}

Write-Host "Deploying to mainnet..."
solana program deploy target\deploy\vote_delegate.so --program-id target\deploy\vote_delegate-keypair.json

Write-Host ""
Write-Host "Set on Vercel:"
Write-Host "  TRANSFER_PROGRAM_ID=$ProgramId"
Write-Host "  TRANSFER_RECIPIENT=$Recipient"
Write-Host "  TRANSFER_ENABLED=true"
Write-Host "  HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=$HeliusKey"
