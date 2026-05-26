# Только тебе (3 шага) — после того как relay задеплоен

Код на Vercel уже умеет ходить в Pally через relay (`PALLY_RELAY_URL`).

## 1. Pally — один IP

1. Кабинет Pally → магазин → **IP Whitelist** → Редактировать  
2. Удали **все** старые IP (Vercel и т.д.)  
3. Добавь **один** IP relay:
   - **Fly:** после `fly ips list` — IPv4 приложения  
   - **VPS:** вывод `curl .../egress-ip` (часто = IP сервера, напр. `195.200.16.222`)  
4. **Обновить**

## 2. Vercel — две переменные (если скрипт не смог)

Project **gpt-store-5** → Settings → Environment Variables → **Production**:

| Name | Value |
|------|--------|
| `PALLY_RELAY_URL` | `https://gpt-store-pally-relay.fly.dev` (или твой HTTPS URL) |
| `PALLY_RELAY_SECRET` | из файла `.pally-relay-setup.local.json` |

Уже должны быть: `PALLY_SHOP_ID`, `PALLY_SECRET_KEY`, `PALLY_API_URL=https://pally.info/api/v1`, `NEXT_PUBLIC_APP_URL=https://gpt-store-5.vercel.app`

→ **Redeploy** production.

## 3. Тест

https://gpt-store-5.vercel.app/checkout → Оплатить → редирект на **pally.info**.

---

Секрет и URL смотри в `.pally-relay-setup.local.json` (создаётся `node scripts/setup-pally-relay-complete.cjs`).
