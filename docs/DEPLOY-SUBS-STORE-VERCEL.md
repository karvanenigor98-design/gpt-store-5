# Subs Store — отдельный Vercel-проект

Репозиторий: https://github.com/buzanovnikita30-hash/subs-store

## Что даёт отдельный деплой

- Свой URL (например `https://subs-store.vercel.app`)
- `STORE_PROFILE=subs-store` → `/` редирект на `/spotify`, лендинг Spotify/Subs
- Тот же код, что GPT Store; на Vercel — другой проект и env

## Env (минимум)

См. `.env.vercel.subs.example`. Ключевое: `STORE_PROFILE=subs-store`.

## CLI

```bash
npx vercel link --yes --project subs-store
# env add из .env.local / .env.vercel.subs.example
npx vercel deploy --prod --yes
```

## Supabase Auth

В Subs Supabase → URL Configuration:

- Site URL: `https://subs-store.vercel.app`
- Redirect URLs: `https://subs-store.vercel.app/**`
