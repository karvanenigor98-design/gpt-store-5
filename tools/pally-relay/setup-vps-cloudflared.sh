#!/bin/bash
# VPS с IP уже в Pally whitelist (напр. 195.200.16.222):
#   export PALLY_RELAY_SECRET='из .pally-relay-setup.local.json'
#   curl -fsSL https://raw.githubusercontent.com/buzanovnikita30-hash/gpt-store-5/main/tools/pally-relay/setup-vps-cloudflared.sh | bash
set -euo pipefail

SECRET="${PALLY_RELAY_SECRET:-}"
if [ -z "$SECRET" ]; then
  echo "export PALLY_RELAY_SECRET='...' && bash setup-vps-cloudflared.sh"
  exit 1
fi

DIR="${PALLY_RELAY_DIR:-/opt/pally-relay}"
mkdir -p "$DIR"
cd "$DIR"

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

curl -fsSL -o server.cjs \
  "https://raw.githubusercontent.com/buzanovnikita30-hash/gpt-store-5/main/tools/pally-relay/server.cjs"

sudo tee /etc/systemd/system/pally-relay.service >/dev/null <<EOF
[Unit]
Description=Pally Relay
After=network.target

[Service]
WorkingDirectory=$DIR
Environment=PALLY_RELAY_SECRET=$SECRET
Environment=PORT=8787
ExecStart=$(command -v node) server.cjs
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now pally-relay

if ! command -v cloudflared >/dev/null 2>&1; then
  curl -fsSL -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  sudo dpkg -i /tmp/cloudflared.deb || sudo apt-get install -fy
fi

sudo tee /etc/systemd/system/pally-relay-tunnel.service >/dev/null <<'EOF'
[Unit]
Description=Cloudflare tunnel for Pally relay
After=network.target pally-relay.service
Requires=pally-relay.service

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel --url http://127.0.0.1:8787 --no-autoupdate
Restart=always
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now pally-relay-tunnel

sleep 5
TUNNEL_URL=$(sudo journalctl -u pally-relay-tunnel -n 80 --no-pager 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)

echo ""
echo "=== health (local) ==="
curl -s -H "X-Pally-Relay-Secret: $SECRET" http://127.0.0.1:8787/health || true
echo ""
echo "=== egress IP (добавь в Pally, если ещё нет) ==="
curl -s -H "X-Pally-Relay-Secret: $SECRET" http://127.0.0.1:8787/egress-ip || true
echo ""

if [ -n "$TUNNEL_URL" ]; then
  echo "=== PALLY_RELAY_URL для Vercel (Production) ==="
  echo "$TUNNEL_URL"
  echo ""
  echo "Vercel → gpt-store-5 → Environment Variables:"
  echo "  PALLY_RELAY_URL = $TUNNEL_URL"
  echo "  PALLY_RELAY_SECRET = (тот же секрет)"
  echo "→ Redeploy production"
else
  echo "Tunnel URL не найден в логах. Выполни:"
  echo "  sudo journalctl -u pally-relay-tunnel -f"
  echo "Скопируй https://....trycloudflare.com → PALLY_RELAY_URL на Vercel"
fi
