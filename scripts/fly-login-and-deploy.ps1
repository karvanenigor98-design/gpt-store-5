# Один скрипт: логин Fly (браузер) + деплой relay
$fly = "$env:USERPROFILE\.fly\bin\flyctl.exe"
if (-not (Test-Path $fly)) {
  Write-Host "Установка flyctl..."
  iwr https://fly.io/install.ps1 -useb | iex
  $fly = "$env:USERPROFILE\.fly\bin\flyctl.exe"
}

$env:Path = "$env:USERPROFILE\.fly\bin;" + $env:Path

Write-Host "`n=== 1/2 Откроется браузер — войди в Fly ===`n"
& $fly auth login
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n=== 2/2 Деплой relay ===`n"
Set-Location "$PSScriptRoot\..\tools\pally-relay"

$secret = "f7efbc09b905c84b2b977f4f0debd5dc82e1961b59e14f10"

& $fly launch --no-deploy --copy-config --name gpt-store-pally-relay --region fra --yes 2>$null
& $fly secrets set "PALLY_RELAY_SECRET=$secret" --app gpt-store-pally-relay
& $fly ips allocate-v4 --app gpt-store-pally-relay
& $fly deploy --app gpt-store-pally-relay --ha=false
& $fly ips list --app gpt-store-pally-relay

Write-Host "`n=== Проверка ==="
curl.exe -H "X-Pally-Relay-Secret: $secret" https://gpt-store-pally-relay.fly.dev/health

Write-Host "`nIP из fly ips list → единственный в Pally whitelist"
Write-Host "Vercel: PALLY_RELAY_URL + PALLY_RELAY_SECRET уже заданы → Redeploy"
