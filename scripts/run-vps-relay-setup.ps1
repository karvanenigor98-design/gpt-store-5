# Открывает SSH на VPS и запускает relay (нужен пароль root или ключ).
# powershell -ExecutionPolicy Bypass -File scripts/run-vps-relay-setup.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$SetupFile = Join-Path $Root ".pally-relay-setup.local.json"

if (-not (Test-Path $SetupFile)) {
  Write-Host "Сначала: node scripts/setup-pally-relay-complete.cjs"
  exit 1
}

$setup = Get-Content $SetupFile -Raw | ConvertFrom-Json
$secret = $setup.PALLY_RELAY_SECRET
$hostAddr = if ($env:VPS_HOST) { $env:VPS_HOST } else { "195.200.16.222" }
$user = if ($env:VPS_USER) { $env:VPS_USER } else { "root" }

$remoteCmd = @"
export PALLY_RELAY_SECRET='$secret'
curl -fsSL https://raw.githubusercontent.com/buzanovnikita30-hash/gpt-store-5/main/tools/pally-relay/setup-vps-cloudflared.sh | bash
"@

Write-Host ""
Write-Host "=== VPS Pally Relay ===" -ForegroundColor Cyan
Write-Host "Сервер: ${user}@${hostAddr}"
Write-Host "Сейчас откроется SSH — введи пароль от VPS (если спросит)."
Write-Host "В конце скопируй PALLY_RELAY_URL (https://....trycloudflare.com)"
Write-Host ""

ssh "${user}@${hostAddr}" $remoteCmd

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "SSH не удался. Проверь:" -ForegroundColor Yellow
  Write-Host "  - пароль/ключ для $hostAddr"
  Write-Host "  - или: `$env:VPS_USER='ubuntu'; `$env:VPS_HOST='195.200.16.222'"
  exit 1
}

Write-Host ""
Write-Host "=== Дальше вручную (2 мин) ===" -ForegroundColor Green
Write-Host "1. Pally → whitelist → только 195.200.16.222"
Write-Host "2. Vercel → gpt-store-5 → PALLY_RELAY_URL + PALLY_RELAY_SECRET → Redeploy"
Write-Host "   Secret уже в .pally-relay-setup.local.json"
