# Pally — только ручные шаги (остальное сделано в коде / .env.local)

## Уже сделано автоматически

- Код: отдельные `shop_id` для GPT (`PALLY_SHOP_ID`) и Spotify (`PALLY_SHOP_ID_SUBS`)
- `.env.local`: shop id + secret + relay (локально)
- Push в `main` → Vercel autodeploy (если был push)

## Тебе нужно сделать (≈10 мин)

### 1. Vercel → gpt-store-5 → Environment Variables → **Production**

Скопируй из `.env.local` (или добавь вручную):

| Key | Откуда |
|-----|--------|
| `PALLY_SHOP_ID` | `.env.local` |
| `PALLY_SHOP_ID_GPT` | то же |
| `PALLY_SHOP_ID_SUBS` | `.env.local` |
| `PALLY_SECRET_KEY` | `.env.local` |
| `PALLY_API_URL` | `https://pally.info/api/v1` |
| `PALLY_TEST_MODE` | `false` |
| `PALLY_RELAY_URL` | `.env.local` (если relay живой) |
| `PALLY_RELAY_SECRET` | `.env.local` |
| `NEXT_PUBLIC_APP_URL` | `https://gpt-store-5.vercel.app` |

**Redeploy** production после сохранения.

Или с ПК (если `vercel login`):

```bash
npm run pally:env:sync
```

### 2. Pally — оба магазина (GPT + Spotify)

В кабинете Pally для shop **G8vrGYLmLR** и **Ok706gzmqj**:

1. **Webhook URL:**
   ```
   https://gpt-store-5.vercel.app/api/payments/pally/webhook
   ```
2. **IP whitelist:** добавь `5.129.221.84` (VPS Timeweb) **или** отключи фильтр IP на время проверки.

### 3. VPS relay (если cloudflare URL умер)

Скрин показывал VPS `5.129.221.84`. Если оплата на prod снова «HTTP 200»:

```bash
ssh root@5.129.221.84
export PALLY_RELAY_SECRET='из .env.local PALLY_RELAY_SECRET'
# скрипт из tools/pally-relay/setup-vps-cloudflared.sh
```

Новый URL туннеля → обнови `PALLY_RELAY_URL` в Vercel → Redeploy.

### 4. Проверка

- GPT: https://gpt-store-5.vercel.app/checkout  
- Spotify: https://gpt-store-5.vercel.app/checkout/spotify  

Кнопка «Оплатить» → редирект на pally.info.

### 5. Безопасность

Токен Pally светился в чате — **смени API token в Pally** и обнови `PALLY_SECRET_KEY` в Vercel + `.env.local`.
