# Pally — только ручные шаги (остальное сделано в коде / .env.local)

## Уже сделано автоматически

- **Баг оплаты:** Pally отдаёт `link_url`, код искал `payment_url` → исправлено (`73cffa0`)
- Код: GPT → `PALLY_SHOP_ID`, Spotify → `PALLY_SHOP_ID_SUBS`
- `.env.local`: оба shop id + secret + relay
- Локальный тест: оба магазина создают счёт (`npm run` → `node scripts/test-pally-both-shops.cjs`)
- Push в `main` → Vercel autodeploy

## Тебе нужно сделать (≈10 мин)

### 1. Vercel → gpt-store-5 → Environment Variables → **Production**

Скопируй из `.env.local` (или добавь вручную):

| Key | Откуда |
|-----|--------|
| `PALLY_SHOP_ID` | `.env.local` |
| `PALLY_SHOP_ID_GPT` | то же |
| `PALLY_SHOP_ID_SUBS` | `.env.local` |
| `PALLY_SECRET_KEY` | `.env.local` |
| `PALLY_WEBHOOK_SECRET` | `.env.local` |
| `PALLY_WEBHOOK_REQUIRE_SIGN` | `true` (production) |
| `PALLY_API_URL` | `https://pally.info/api/v1` |
| `PALLY_TEST_MODE` | `false` |
| `PALLY_RELAY_URL` | `.env.local` (если relay живой) |
| `PALLY_RELAY_SECRET` | `.env.local` |
| `NEXT_PUBLIC_GPT_SITE_URL` | `https://gptplus-store.ru` |
| `GPT_SITE_URL` | `https://gptplus-store.ru` |
| `NEXT_PUBLIC_SPOTIFY_SITE_URL` | `https://spotify-store.ru` |
| `SPOTIFY_SITE_URL` | `https://spotify-store.ru` |

**Redeploy** production после сохранения.

Локально: `npm run pally:cabinet-urls` — ссылки для кабинета Pally.

Или с ПК (если `vercel login`):

```bash
npm run pally:env:sync
```

### 2. Pally — оба магазина (GPT + Spotify)

В кабинете Pally → каждый shop → **Ссылки** (символ-в-символ, иначе `url_not_allowed`):

#### GPT (`PALLY_SHOP_ID` / `PALLY_SHOP_ID_GPT`)

| Поле | URL |
|------|-----|
| URL магазина | `https://gptplus-store.ru/` |
| Success URL | `https://gptplus-store.ru/checkout/success` |
| Fail URL | `https://gptplus-store.ru/checkout/fail` |
| Result URL | `https://gptplus-store.ru/api/payments/pally/webhook` |

#### Spotify (`PALLY_SHOP_ID_SUBS`)

| Поле | URL |
|------|-----|
| URL магазина | `https://spotify-store.ru/` |
| Success URL | `https://spotify-store.ru/checkout/success` |
| Fail URL | `https://spotify-store.ru/checkout/fail` |
| Result URL | `https://spotify-store.ru/api/payments/pally/webhook` |

Refund / Chargeback — оставить пустыми.

**IP whitelist:** relay VPS IP **или** отключи фильтр IP на время проверки.

### 3. VPS relay (если cloudflare URL умер)

Скрин показывал VPS `5.129.221.84`. Если оплата на prod снова «HTTP 200»:

```bash
ssh root@5.129.221.84
export PALLY_RELAY_SECRET='из .env.local PALLY_RELAY_SECRET'
# скрипт из tools/pally-relay/setup-vps-cloudflared.sh
```

Новый URL туннеля → обнови `PALLY_RELAY_URL` в Vercel → Redeploy.

### 4. Проверка

- GPT: https://gptplus-store.ru/checkout  
- Spotify: https://spotify-store.ru/checkout/spotify  

Кнопка «Оплатить» → редирект на pally.info.

### 5. Безопасность

Токен Pally светился в чате — **смени API token в Pally** и обнови `PALLY_SECRET_KEY` в Vercel + `.env.local`.
