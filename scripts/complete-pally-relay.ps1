# Полная настройка Pally relay (VPS → Vercel).
# powershell -ExecutionPolicy Bypass -File scripts/complete-pally-relay.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$KeyPath = Join-Path $Root ".vps-deploy-key"
$SetupFile = Join-Path $Root ".pally-relay-setup.local.json"
$OutFile = Join-Path $Root ".pally-relay-deployed.local.json"
$HostAddr = if ($env:VPS_HOST) { $env:VPS_HOST } else { "195.200.16.222" }
$User = if ($env:VPS_USER) { $env:VPS_USER } else { "root" }

if (-not (Test-Path $SetupFile)) {
  node scripts/setup-pally-relay-complete.cjs
}
$secret = (Get-Content $SetupFile -Raw | ConvertFrom-Json).PALLY_RELAY_SECRET

if (-not (Test-Path $KeyPath)) {
  ssh-keygen -t ed25519 -f $KeyPath -N '""' -q
}

$pubKey = Get-Content "$KeyPath.pub" -Raw

Write-Host ""
Write-Host "========== ШАГ 1/3: SSH-ключ на VPS ==========" -ForegroundColor Cyan
Write-Host "Панель хостинга (Timeweb/REG и т.д.) → VPS $HostAddr → SSH-ключи"
Write-Host "Вставь ЭТУ строку целиком и сохрани:"
Write-Host ""
Write-Host $pubKey.Trim() -ForegroundColor Yellow
Write-Host ""
Set-Clipboard -Value $pubKey.Trim()
Write-Host "(скопировано в буфер обмена)" -ForegroundColor Green
Write-Host ""
Read-Host "После добавления ключа в панели нажми Enter"

Write-Host ""
Write-Host "========== ШАГ 2/3: Деплой relay на VPS ==========" -ForegroundColor Cyan

$remoteCmd = @"
export PALLY_RELAY_SECRET='$secret'
curl -fsSL https://raw.githubusercontent.com/buzanovnikita30-hash/gpt-store-5/main/tools/pally-relay/setup-vps-cloudflared.sh | bash
"@

ssh -i $KeyPath -o StrictHostKeyChecking=no "${User}@${HostAddr}" $remoteCmd
if ($LASTEXITCODE -ne 0) {
  Write-Host "SSH failed. Try password login: npm run pally:relay:vps" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Введи PALLY_RELAY_URL (https://....trycloudflare.com из вывода выше):" -ForegroundColor Yellow
$relayUrl = Read-Host "URL"
$relayUrl = $relayUrl.Trim()
if (-not $relayUrl.StartsWith("http")) {
  Write-Host "Invalid URL"
  exit 1
}

@{ PALLY_RELAY_URL = $relayUrl; deployedAt = (Get-Date).ToString("o") } | ConvertTo-Json | Set-Content $OutFile -Encoding UTF8

Write-Host ""
Write-Host "========== ШАГ 3/3: Vercel + Pally ==========" -ForegroundColor Cyan
Write-Host "Pally whitelist: ONLY $HostAddr"
Write-Host ""
Write-Host "Vercel → gpt-store-5 → Environment Variables → Production:"
Write-Host "  PALLY_RELAY_URL = $relayUrl"
Write-Host "  PALLY_RELAY_SECRET = (from .pally-relay-setup.local.json)"
Write-Host ""
Write-Host "Then: Deployments → Redeploy"
Write-Host ""

$open = Read-Host "Open Vercel env page in browser? (y/n)"
if ($open -eq "y") {
  Start-Process "https://vercel.com/chatgbt15/gpt-store-5/settings/environment-variables"
}

Write-Host "Done. Test: https://gpt-store-5.vercel.app/checkout" -ForegroundColor Green
