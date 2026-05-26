# Pally Relay (фиксированный IP для whitelist)

Vercel меняет исходящий IP → Pally режет `ip_access_denied`. Relay на VPS/Fly с **одним** IP.

## Fly.io (рекомендуется)

```bash
cd tools/pally-relay
fly launch --no-deploy
fly secrets set PALLY_RELAY_SECRET="$(openssl rand -hex 24)"
fly ips allocate-v4
fly deploy
fly ips list
```

1. IP из `fly ips list` → **единственный** адрес в Pally whitelist  
2. Vercel → Environment Variables:
   - `PALLY_RELAY_URL` = `https://gpt-store-pally-relay.fly.dev` (ваш URL)
   - `PALLY_RELAY_SECRET` = тот же секрет  
3. Redeploy `gpt-store-5`

Проверка egress relay: `curl https://YOUR-RELAY.fly.dev/egress-ip`

## Свой VPS (195.200.16.222 и т.д.)

```bash
PALLY_RELAY_SECRET=xxx node tools/pally-relay/server.cjs
```

Whitelist в Pally: **только IP этого сервера**.  
`PALLY_RELAY_URL` на Vercel = `https://your-vps.example.com` (через nginx + TLS).
