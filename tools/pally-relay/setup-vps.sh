#!/bin/bash
# На VPS (195.200.16.222): 
#   export PALLY_RELAY_SECRET='секрет_из_setup'
#   curl -sSL https://raw.githubusercontent.com/buzanovnikita30-hash/gpt-store-5/main/tools/pally-relay/setup-vps.sh | bash
# Или скопируй папку tools/pally-relay и: bash setup-vps.sh

set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SECRET="${PALLY_RELAY_SECRET:-}"

if [ -z "$SECRET" ]; then
  echo "Задай: export PALLY_RELAY_SECRET='...'"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

sudo tee /etc/systemd/system/pally-relay.service >/dev/null <<EOF
[Unit]
Description=Pally Relay
After=network.target

[Service]
WorkingDirectory=$DIR
Environment=PALLY_RELAY_SECRET=$SECRET
ExecStart=$(command -v node) server.cjs
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now pally-relay

sleep 1
echo "=== health ==="
curl -s -H "X-Pally-Relay-Secret: $SECRET" http://127.0.0.1:8787/health
echo ""
echo "=== egress IP (добавь в Pally whitelist) ==="
curl -s -H "X-Pally-Relay-Secret: $SECRET" http://127.0.0.1:8787/egress-ip
echo ""
echo "Дальше: HTTPS (nginx/certbot или cloudflared tunnel) → PALLY_RELAY_URL на Vercel"
