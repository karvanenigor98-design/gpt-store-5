# Supabase Auth — письма подтверждения и сброса пароля

Приложение использует **два** Supabase-проекта: GPT STORE (`gpt-store`) и SPOTIFY STORE (`subs-store`, slug в коде).

## Site URL (оба проекта)

```
https://gpt-store-5.vercel.app
```

Публичный лендинг Spotify: `https://gpt-store-5.vercel.app/spotify` — **не** подставляйте его в Site URL.

## Redirect URLs (обязательные)

Должны быть в allowlist **каждого** проекта:

```
https://gpt-store-5.vercel.app/auth/callback
https://gpt-store-5.vercel.app/callback
https://gpt-store-5.vercel.app/verify-email
https://gpt-store-5.vercel.app/login
https://gpt-store-5.vercel.app/register
https://gpt-store-5.vercel.app/cabinet
https://gpt-store-5.vercel.app/reset-password
https://gpt-store-5.vercel.app/reset-password/update
```

Для локальной разработки — порты `3055` (Spotify) и `3056` (GPT), как уже настроено.

### Удалить мусор

Если в списке есть URL вида:

```
https://gpt-store-5.vercel.app/spotifyEmailtemplates{{...}}
```

— это опечатка в шаблоне письма (склеились `spotify` + `Email templates` + `{{`). **Удалите** из Redirect URLs. В коде такой URL не используется.

## Шаблон «Confirm signup» (критично для другого устройства)

Стандартная ссылка `{{ .ConfirmationURL }}` с PKCE часто открывается с `?code=`, который **не работает** на телефоне, если регистрация была на ПК (нет `code_verifier`).

Рекомендуемая кнопка в шаблоне (GPT и Spotify — одинаково, бренд в тексте письма):

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&site=gpt-store&returnUrl=/cabinet?site=gpt-store">
  Подтвердить email
</a>
```

Для **SPOTIFY STORE** (тот же Supabase-проект subs, если письма оттуда):

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&site=subs-store&returnUrl=/cabinet?site=subs-store">
  Подтвердить email
</a>
```

Либо оставьте `{{ .ConfirmationURL }}`, но тогда `emailRedirectTo` при регистрации должен вести на `/auth/callback?...` (уже так в коде) — и всё равно возможны сбои PKCE на другом устройстве, пока не перейдёте на `token_hash`.

В тексте писем используйте **GPT STORE** / **SPOTIFY STORE**, не «Subs Store».

## Шаблон «Reset password»

Сброс через API приложения предпочитает `generateLink` + `token_hash` → `/auth/callback?type=recovery&site=...`.

Если письмо идёт только из Supabase SMTP, `redirectTo` в коде: `/auth/callback?type=recovery&site=...`.

## Переменные окружения (production)

```
NEXT_PUBLIC_APP_URL=https://gpt-store-5.vercel.app
NEXT_PUBLIC_GPT_STORE_URL=https://gpt-store-5.vercel.app
NEXT_PUBLIC_SPOTIFY_STORE_URL=https://gpt-store-5.vercel.app/spotify
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_SUBS_SUPABASE_URL=...
NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY=...
```

Не задавайте production `NEXT_PUBLIC_APP_URL` на `127.0.0.1` — иначе письма могут уйти на localhost.
