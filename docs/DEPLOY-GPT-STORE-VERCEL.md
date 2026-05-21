# Деплой GPT STORE (лендинг) — GitHub + Vercel

Пошагово: сначала выкладываем **только лендинг GPT Store** (`/`). Subs Store (`/spotify`) и админку подключаем позже отдельными env.

## 1. Репозиторий GitHub

Проект уже привязан к:

- `https://github.com/buzanovnikita30-hash/gpt-store-4.git` (remote `gpt-store-4`)

```powershell
cd C:\Users\User\Desktop\Chat_Spotify-main-ascii

git add .
git status
git commit -m "GPT Store: UI fixes, port split, Vercel deploy config"
git push gpt-store-4 main
```

Если `main` не существует на remote — `git push -u gpt-store-4 HEAD:main`.

> **Не коммить** `.env.local` — он в `.gitignore`.

---

## 2. Проект в Vercel

1. Открой [vercel.com/new](https://vercel.com/new) → **Import Git Repository**.
2. Выбери `buzanovnikita30-hash/gpt-store-4`.
3. **Framework Preset:** Next.js (подхватится из `vercel.json`).
4. **Root Directory:** `./` (корень репо).
5. **Build Command:** `npm run build` (по умолчанию).
6. **Install Command:** `npm install`.

Не включай пока отдельные monorepo-папки — один Next.js проект.

---

## 3. Environment Variables (минимум для лендинга GPT)

В Vercel → Project → **Settings** → **Environment Variables** добавь для **Production** и **Preview**:

| Переменная | Обязательно | Пример / откуда |
|------------|-------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | да | Supabase GPT → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | да | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | да* | service_role (сервер: отзывы, тарифы) |
| `NEXT_PUBLIC_APP_URL` | да | `https://твой-проект.vercel.app` (после первого деплоя подставь реальный URL) |
| `NEXT_PUBLIC_GPT_STORE_URL` | да | то же, что `NEXT_PUBLIC_APP_URL` |

\* Без service role лендинг откроется, но блок отзывов/тарифов из БД может быть пустым (есть статический fallback).

### Можно отложить (для полного сайта позже)

- `SUBS_SUPABASE_*` — Subs Store
- `PALLY_*`, `RESEND_*`, `SMTP_*`, `TELEGRAM_*`, `CRON_SECRET`
- `DEEPSEEK_API_KEY` — AI-чат

Для **первого деплоя лендинга** их можно не задавать.

---

## 4. Первый деплой

1. **Deploy** в Vercel (или push в `main` — автодеплой).
2. Дождись зелёного билда (сборка идёт на серверах Vercel, не на твоём ПК).
3. Открой `https://<project>.vercel.app/` — должен быть **GPT STORE** лендинг (белый, зелёный акцент).
4. Вернись в env и обнови:
   - `NEXT_PUBLIC_APP_URL=https://<project>.vercel.app`
   - `NEXT_PUBLIC_GPT_STORE_URL=https://<project>.vercel.app`
5. **Redeploy** (Deployments → … → Redeploy), чтобы metadata/sitemap подтянули правильный домен.

---

## 5. Supabase Auth (для логина/кабинета позже)

В Supabase → **Authentication** → **URL Configuration**:

- **Site URL:** `https://<project>.vercel.app`
- **Redirect URLs:**
  - `https://<project>.vercel.app/auth/callback`
  - `https://<project>.vercel.app/**`

Локально по-прежнему:

- GPT: `npm run dev:gpt` → `http://127.0.0.1:3056/`
- Subs: `npm run dev:subs` → `http://127.0.0.1:3055/spotify`

---

## 6. Свой домен (опционально)

Vercel → **Settings** → **Domains** → добавь домен → DNS по инструкции Vercel.

После привязки обнови в env и Supabase:

- `NEXT_PUBLIC_APP_URL=https://твой-домен.ru`
- `NEXT_PUBLIC_GPT_STORE_URL=https://твой-домен.ru`

---

## 7. Что на production по маршрутам

| URL | Сейчас |
|-----|--------|
| `/` | GPT STORE лендинг |
| `/gpt`, `/login`, `/checkout` | GPT (работают при настроенном Supabase) |
| `/spotify` | Subs (нужны `SUBS_*` env) |
| `/admin` | Админка GPT Supabase |

На Vercel **нет** разделения портов 3055/3056 — всё на одном домене; GPT = `/`, Subs = `/spotify`.

---

## 8. Локальная проблема ENOSPC

Если `npm run build` падает с `no space left on device` — освободи место на диске C: или чисти:

```powershell
npm run clean
Remove-Item -Recurse -Force .next, .next-gpt, .next-subs -ErrorAction SilentlyContinue
```

Проверка сборки не обязательна перед Vercel — билд в облаке.

---

## 9. CLI (если установишь позже)

```powershell
npm i -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel --prod
```

---

## Чеклист «лендинг жив»

- [ ] `https://…vercel.app/` — Hero, тарифы, FAQ
- [ ] Нет редиректа на `/spotify` с главной
- [ ] Чат-виджет открывается (нужен DeepSeek/OpenRouter только для AI-ответов)
- [ ] В Supabase redirect URLs добавлен production URL
