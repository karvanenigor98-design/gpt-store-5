# Pally оплата — что сделать (2 минуты)

## Сейчас (быстрый фикс)

1. **Pally** → магазин → **IP Whitelist** → добавь IP (все, что видишь):
   - `3.125.159.150` (из ошибки на checkout)
   - `63.179.91.11` (текущий prod egress)
   - Локально: `node scripts/print-vercel-pally-egress.cjs` — список актуальных IP
2. **Сохранить** в Pally
3. Подожди redeploy Vercel (уже запушен) → тест checkout

> IP Vercel меняются — через день снова может упасть. Ниже постоянное решение.

---

## Постоянно (relay на VPS `195.200.16.222`)

На VPS (SSH):

```bash
export PALLY_RELAY_SECRET='из .pally-relay-setup.local.json'
curl -fsSL https://raw.githubusercontent.com/buzanovnikita30-hash/gpt-store-5/main/tools/pally-relay/setup-vps-cloudflared.sh | bash
```

Скрипт выведет `PALLY_RELAY_URL` (https://….trycloudflare.com).

**Vercel** → gpt-store-5 → Production:

| Name | Value |
|------|--------|
| `PALLY_RELAY_URL` | URL из скрипта |
| `PALLY_RELAY_SECRET` | тот же секрет |

**Pally whitelist** — только **один** IP: `195.200.16.222` (или egress из `curl …/egress-ip` на VPS).

→ **Redeploy** production.

---

## Альтернатива: Fly.io

1. Карта: https://fly.io/dashboard/buzanovnikita30-gmail-com/billing  
2. `node scripts/deploy-pally-relay-fly.cjs`  
3. `fly ips list` → один IP в Pally  
4. `node scripts/set-pally-relay-vercel-env.cjs`
