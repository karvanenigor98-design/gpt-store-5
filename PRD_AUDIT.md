# PRD / ТЕХНИЧЕСКИЙ АУДИТ
## Проект: GPT STORE + Subs Store
### Дата аудита: 07.05.2026 | Версия: 1.0

---

# СОДЕРЖАНИЕ

1. [Executive Summary](#1-executive-summary)
2. [Текущее состояние проекта](#2-текущее-состояние-проекта)
3. [Что реализовано хорошо](#3-что-реализовано-хорошо)
4. [Что реализовано частично](#4-что-реализовано-частично)
5. [Что сломано или вызывает вопросы](#5-что-сломано-или-вызывает-вопросы)
6. [Процент готовности по блокам](#6-процент-готовности-по-блокам)
7. [Общая оценка готовности](#7-общая-оценка-готовности)
8. [Что не хватает для сдачи](#8-что-не-хватает-для-сдачи)
9. [Критические риски](#9-критические-риски)
10. [Рекомендуемый порядок работ](#10-рекомендуемый-порядок-работ)
11. [Подробный план этапов](#11-подробный-план-этапов)
12. [Что делать прямо сейчас](#12-что-делать-прямо-сейчас)
13. [Что можно отложить](#13-что-можно-отложить)
14. [Cursor-промпт для этапа 1](#14-cursor-промпт-для-этапа-1)

---

# 1. EXECUTIVE SUMMARY

Проект находится на **стадии продвинутого MVP** с неравномерной готовностью блоков.

Архитектура заложена грамотно — Next.js 14, route groups, Supabase с типизацией, multi-site framework в коде. Большинство UI-страниц и API-маршрутов существуют. Однако **не проверена реальная работа** критических интеграций: платёжка (Pally), email (Resend), Telegram-уведомления, RLS в Supabase.

### Ключевые пробелы:
- Нет страницы оферты (`/offer`) — юридически обязательно
- Промокоды/скидки не site-aware — риск утечки скидок между сайтами
- `store-config.ts` работает только для ChatGPT-планов, Spotify-цены статичны
- `/support` требует авторизации — гости не могут написать в поддержку
- RLS политики Supabase — не верифицированы

**Итог:** ~62% готовности по коду. До MVP для реальных продаж нужно закрыть 12–15 конкретных задач.

---

# 2. ТЕКУЩЕЕ СОСТОЯНИЕ ПРОЕКТА

| Параметр | Значение |
|---|---|
| Framework | Next.js 14.2.35 |
| Язык | TypeScript |
| База данных | Supabase (PostgreSQL) |
| Деплой | Vercel |
| Платёжка | Pally + опционально CryptoCloud |
| Email | Resend API |
| Уведомления | Telegram Bot + Email throttle |
| AI-чат | Anthropic SDK (Claude) |
| Multi-site | gpt-store + subs-store |
| Роли | client / operator / admin (super_admin через email) |
| Главный админ | nbuzanov0@mail.ru (захардкожен, снять нельзя) |

### Структура проекта

```
app/
├── (public)/          — лендинги, FAQ, отзывы, юридика, поддержка
├── (auth)/            — login, register, callback, reset, verify
├── (dashboard)/       — кабинет пользователя
├── (admin)/           — панель администратора
├── (operator)/        — панель оператора
├── (checkout)/        — чекаут GPT + Spotify
└── api/               — все backend API routes

components/
├── admin/             — SiteSwitcher, OrdersTable, OrderDrawer
├── analytics/         — YandexMetrika
├── cabinet/           — OrderCard, StatusBadge, MessageThread
├── chat/              — AIChat, OperatorChat, ChatWindow, GuestChat
├── layout/            — Navbar, Footer, LandingFooter
├── sections/          — все секции GPT STORE лендинга
├── spotify/           — все секции Subs Store лендинга
└── ui/                — Button, Card, Badge, AnimateSection и др.

lib/
├── auth/              — роли, superAdmin, postLoginPath, syncRole
├── chat/              — autoResponder, scriptedFaq, messageSender
├── payments/          — pally.ts, crypto.ts
├── supabase/          — client.ts, server.ts, admin.ts, middleware.ts
└── telegram/          — bot.ts, notifications.ts
```

---

# 3. ЧТО РЕАЛИЗОВАНО ХОРОШО

### Архитектура
- ✅ Route groups с чистым разделением (public / auth / dashboard / admin / operator / checkout)
- ✅ Трёхуровневый Supabase-setup: `client.ts` / `server.ts` / `admin.ts`
- ✅ `types/database.ts` — полная типизация всех таблиц (384 строки)
- ✅ `middleware.ts` — корректная защита маршрутов + роль-aware редиректы
- ✅ `lib/auth/superAdmin.ts` — `nbuzanov0@mail.ru` захардкожен как super_admin, снять через UI невозможно
- ✅ `lib/sites.ts` — multi-site конфиг (gpt-store / subs-store) с productPrefix, путями, брендингом

### Лендинги
- ✅ GPT STORE (`/`) — Hero, Pricing, HowItWorks, Safety, WhyCheaper, Compare, Reviews, FAQ, FinalCTA, ChatWidget
- ✅ Subs Store (`/spotify`) — полный отдельный лендинг со Spotify-компонентами, своим SEO, JSON-LD
- ✅ Динамические цены из `getStoreConfig()` (ChatGPT-планы)

### Авторизация
- ✅ Все страницы: login, register, callback, forgot-password, verify-email, reset-password, update
- ✅ PKCE callback в `app/auth/callback/route.ts`
- ✅ Middleware + role-aware редиректы
- ✅ `dev-login` заблокирован в production (NODE_ENV === "production" → 404)

### Платёжка
- ✅ Pally API: `create` + `webhook` с проверкой подписи (`verifyPallyWebhook`)
- ✅ CryptoCloud API routes
- ✅ Spotify order route (`app/api/spotify/order/route.ts`)
- ✅ Полные статусы: `pending → paid → activating → waiting_client → active → failed → refunded → expired`

### Чат
- ✅ AI-чат (Anthropic), operator-чат, staff-чат, guest-чат
- ✅ API routes: `/api/chat/*`, AI route, auto-reply, attachment, unread
- ✅ Компоненты: AIChat, ChatWindow, OperatorChat, GuestOperatorChat, RoomList, MessageBubble

### Уведомления
- ✅ Таблица `notifications` с `site_id`, `recipient_role`, `NotificationType`
- ✅ `lib/telegram/notifications.ts` — отправка в Telegram
- ✅ `lib/chat/email-notification-throttle.ts` — throttle email-уведомлений
- ✅ Страница `/admin/notifications`

### SEO
- ✅ Metadata + Open Graph на обоих лендингах
- ✅ `app/sitemap.ts` — оба сайта (/ и /spotify) включены
- ✅ `app/robots.ts` — корректные disallow-пути (/admin/, /api/, /dashboard/, /checkout/)
- ✅ JSON-LD Organization schema на обоих лендингах
- ✅ `YandexMetrika` компонент

---

# 4. ЧТО РЕАЛИЗОВАНО ЧАСТИЧНО

### Multi-site data isolation — ~55%
- `site_id` есть в: `orders`, `chat_sessions`, `reviews`, `notifications`
- `site_id` **отсутствует** в: `promocodes`, `landing_discounts`
- Фильтрация заказов идёт через `product` поле (prefix-based), а не через `site_id` напрямую
- `user_site_access` таблица есть в типах, но использование в UI не верифицировано

### Spotify pricing management — ~30%
- `store-config.ts` работает только с `CHATGPT_PLANS`
- Spotify-тарифы живут в `lib/content/spotify.ts` как **статичный контент**
- Через `/admin/settings` управлять Spotify-планами нельзя
- Изменить цену Spotify-тарифа = деплой

### Кабинет пользователя — ~60%
- Dashboard layout использует `DashboardSiteLogo` / `DashboardSiteHeaderTitle` (динамический бренд)
- Как фильтруются заказы для Spotify-пользователя (`/dashboard?site=subs-store`) — требует runtime проверки

### Чат и /support — ~60%
- `middleware.ts` включает `/support` в `protectedPaths` → требует авторизации
- `GuestOperatorChat` компонент существует, но `/support` его не покажет неавторизованному
- Гостевой ChatWidget на лендинге работает отдельно от `/support`

### Юридические страницы — ~35%
- `/privacy` и `/terms` существуют
- `terms/page.tsx` хардкожит "GPT STORE" бренд — не site-aware для Subs Store
- Нет `/offer` (оферта) — упоминается в футере, даёт 404

### Sitemap — ~70%
- Включает оба сайта, но `getPublicSiteOrigin()` с fallback `https://subrf.ru`
- Если `NEXT_PUBLIC_APP_URL` не задан → sitemap с неправильным доменом

---

# 5. ЧТО СЛОМАНО ИЛИ ВЫЗЫВАЕТ ВОПРОСЫ

## Критические проблемы (обнаруженные в коде)

| # | Проблема | Файл | Критичность |
|---|---|---|---|
| 1 | Нет страницы `/offer` (оферта) | `app/(public)/` — отсутствует | 🔴 Критично |
| 2 | `promocodes` без `site_id` | `types/database.ts` строка 297 | 🔴 Критично |
| 3 | `landing_discounts` без `site_id` | `types/database.ts` строка 329 | 🔴 Критично |
| 4 | `/support` в `protectedPaths` | `middleware.ts` строка 38 | 🔴 Критично |
| 5 | `terms/page.tsx` захардкожен как "GPT STORE" | `app/(public)/terms/page.tsx` строка 17 | 🟠 Важно |
| 6 | Spotify-планы статичны | `lib/content/spotify.ts` | 🟠 Важно |
| 7 | `npm run build` статус неизвестен | — | 🔴 Критично |

## Нельзя проверить без runtime-доступа

| # | Что нужно проверить | Риск при сбое |
|---|---|---|
| 8 | Работают ли Pally-платежи (webhook signature) | Деньги не поступают |
| 9 | Реально ли уходят письма через Resend | Пользователи не подтверждают email |
| 10 | Настроен ли Telegram Bot (токен, chat_id) | Уведомления не приходят |
| 11 | Существуют ли таблицы Supabase в production | Сайт падает при любом запросе к БД |
| 12 | Настроены ли RLS политики | Пользователь видит чужие заказы |
| 13 | `NEXT_PUBLIC_APP_URL` в Vercel env | Sitemap/OG с неправильным доменом |
| 14 | Yandex Metrika ID (`NEXT_PUBLIC_YANDEX_METRIKA_ID`) | Аналитика не работает |

---

# 6. ПРОЦЕНТ ГОТОВНОСТИ ПО БЛОКАМ

## 1. GPT STORE лендинг — 78%

| Статус | Описание |
|---|---|
| ✅ Сделано | Все секции, динамические цены, SEO, JSON-LD, ChatWidget |
| ❌ Не хватает | Страница /offer (ссылки в футере → 404) |
| ❌ Не проверено | Работа CTA кнопок в runtime |
| **Критичность** | **Высокая** |

---

## 2. Subs Store лендинг — 68%

| Статус | Описание |
|---|---|
| ✅ Сделано | Отдельная страница /spotify, полный набор Spotify-компонентов, SEO, JSON-LD, отдельный чекаут |
| ❌ Не хватает | Динамические цены (сейчас статика), своих terms/privacy для Subs Store |
| ❌ Не проверено | Кнопка "Кабинет" → /dashboard?site=subs-store в runtime |
| **Критичность** | **Высокая** |

---

## 3. Multi-site архитектура — 55%

| Статус | Описание |
|---|---|
| ✅ Сделано | lib/sites.ts, site_id в orders/chat_sessions/reviews/notifications, SiteSwitcher, /admin/sites |
| ❌ Не хватает | site_id в promocodes и landing_discounts |
| ❌ Не хватает | Spotify-планы вне store-config.ts |
| ❌ Риск | Фильтрация через product-prefix — workaround, не надёжно |
| **Критичность** | **Высокая** |

---

## 4. Авторизация — 72%

| Статус | Описание |
|---|---|
| ✅ Сделано | Все страницы auth, PKCE callback, middleware, dev-login заблокирован в prod |
| ❌ Не проверено | Реальная работа confirm email через Resend |
| ❌ Не проверено | Reset password end-to-end |
| **Критичность** | **Критическая** |

---

## 5. Кабинет пользователя — 60%

| Статус | Описание |
|---|---|
| ✅ Сделано | /dashboard с sidebar, orders, chat, profile, DashboardSiteLogo |
| ❌ Не проверено | Фильтрация заказов по site в /dashboard/orders |
| ❌ Не проверено | Разделение GPT vs Spotify заказов в кабинете |
| **Критичность** | **Средняя** |

---

## 6. Чат — 62%

| Статус | Описание |
|---|---|
| ✅ Сделано | AI-чат, operator-чат, staff-чат, guest-чат, все API routes |
| ❌ Сломано | /support требует авторизации (protectedPaths) |
| ❌ Не проверено | AI API key работает, разделение чатов по сайтам |
| **Критичность** | **Высокая** |

---

## 7. Админка — 68%

| Статус | Описание |
|---|---|
| ✅ Сделано | Все разделы: orders, clients, users, chat, notifications, promocodes, discounts, reviews, settings, sites |
| ✅ Сделано | SiteSwitcher, AdminAlertsBar, role gate в layout |
| ❌ Не хватает | Управление Spotify-тарифами в Settings |
| ❌ Не проверено | Фильтрация данных по site в runtime |
| **Критичность** | **Средняя** |

---

## 8. Роли и доступы — 65%

| Статус | Описание |
|---|---|
| ✅ Сделано | client/operator/admin типизированы, super_admin email-based, role_audit таблица, middleware checks |
| ❌ Риск | Нет super_admin в DB enum — только email-based |
| ❌ Не проверено | RLS политики в Supabase |
| **Критичность** | **Высокая (безопасность)** |

---

## 9. Заказы — 65%

| Статус | Описание |
|---|---|
| ✅ Сделано | Полная схема orders с site_id, статусами, страницы в admin/operator/dashboard |
| ❌ Не проверено | Реальное создание заказов при оплате |
| ❌ Риск | Фильтрация по site через product-prefix |
| **Критичность** | **Критическая** |

---

## 10. Оплата — 42%

| Статус | Описание |
|---|---|
| ✅ Сделано | Pally API routes (create + webhook с signature verify), Crypto routes, Spotify order route |
| ❌ Не проверено | Ключи Pally в production env |
| ❌ Не проверено | Webhook URL зарегистрирован в Pally dashboard |
| ❌ Не проверено | End-to-end тест оплаты |
| **Критичность** | **Критическая** |

---

## 11. Тарифы/промокоды/скидки — 55%

| Статус | Описание |
|---|---|
| ✅ Сделано | promocodes + landing_discounts таблицы, admin CRUD UI и API, store-config.ts |
| ❌ Критично | Промокоды без site_id — глобальные (утечка скидок) |
| ❌ Критично | Скидки без site_id — глобальные |
| ❌ Не хватает | Spotify-тарифы вне системы store-config |
| **Критичность** | **Высокая** |

---

## 12. Отзывы/FAQ — 58%

| Статус | Описание |
|---|---|
| ✅ Сделано | reviews таблица с site_id, компоненты ReviewsSection + SpotifyReviews, admin reviews + API |
| ❌ Не проверено | SpotifyReviews берёт данные из статики или из БД с site_id фильтром? |
| ❌ Не проверено | SpotifyFaq — статичный компонент vs DB-driven |
| **Критичность** | **Средняя** |

---

## 13. Уведомления — 60%

| Статус | Описание |
|---|---|
| ✅ Сделано | notifications таблица с site_id, /admin/notifications, telegram lib, email throttle |
| ❌ Не проверено | Dropdown поведение (закрытие, звук, "прочитать всё") |
| ❌ Не проверено | Telegram bot токен настроен в env? |
| **Критичность** | **Средняя** |

---

## 14. Email/SMTP — 40%

| Статус | Описание |
|---|---|
| ✅ Сделано | Resend API в коде, .env.example с RESEND_API_KEY |
| ❌ Не проверено | RESEND_API_KEY в Vercel env |
| ❌ Не проверено | Supabase auth emails (confirm signup) настроены? |
| ❌ Не проверено | Кастомные email templates в Supabase Dashboard |
| **Критичность** | **Критическая** |

---

## 15. SEO/аналитика — 62%

| Статус | Описание |
|---|---|
| ✅ Сделано | Metadata + OG на обоих лендингах, sitemap.ts, robots.ts, YandexMetrika |
| ❌ Не проверено | NEXT_PUBLIC_YANDEX_METRIKA_ID задан в env? |
| ❌ Риск | NEXT_PUBLIC_APP_URL не задан → sitemap c subrf.ru |
| **Критичность** | **Средняя** |

---

## 16. Юридические страницы — 35%

| Статус | Описание |
|---|---|
| ✅ Сделано | /privacy существует, /terms существует |
| ❌ Критично | Нет /offer (оферта) — 404 |
| ❌ Не хватает | terms захардкожен как "GPT STORE" — не работает для Subs Store |
| ❌ Не хватает | Subs Store не имеет своих terms/privacy |
| **Критичность** | **Высокая** |

---

## 17. UX/UI и адаптив — 65%

| Статус | Описание |
|---|---|
| ✅ Сделано | Tailwind responsive классы, sidebar адаптив в dashboard, mobile header |
| ❌ Не проверено | Мобильный вид лендингов, чата, чекаута — только в runtime |
| ❌ Не проверено | CursorTrail, AnimatedBackground на мобиле |
| **Критичность** | **Средняя** |

---

## 18. Продакшен-готовность — 38%

| Статус | Описание |
|---|---|
| ✅ Сделано | error.tsx, global-error.tsx, not-found.tsx, next.config.mjs без лишних флагов |
| ❌ Критично | npm run build — не запускался, TypeScript ошибки неизвестны |
| ❌ Критично | .env variables в Vercel — не верифицированы |
| ❌ Критично | Supabase tables в production — не верифицированы |
| ❌ Критично | RLS политики — не верифицированы |
| ❌ Критично | Webhook URLs в Pally/Telegram — не зарегистрированы (предположительно) |
| **Критичность** | **Критическая** |

---

# 7. ОБЩАЯ ОЦЕНКА ГОТОВНОСТИ

| Метрика | Процент |
|---|---|
| **Общий процент готовности проекта** | **62%** |
| Готовность к демо (показать инвестору/клиенту) | **72%** |
| Готовность к запуску рекламы | **38%** |
| Готовность к реальным продажам | **30%** |
| Техническая готовность (код) | **62%** |
| Продуктовая готовность | **55%** |

---

# 8. ЧТО НЕ ХВАТАЕТ ДЛЯ СДАЧИ

## 🔴 КРИТИЧНО (блокирует реальные продажи)

| # | Чего не хватает | Почему важно | Где в проекте | Что сделать | Приоритет |
|---|---|---|---|---|---|
| 1 | **Страница /offer (оферта)** | Юридически обязательно, ссылки из футера → 404 | `app/(public)/offer/page.tsx` — отсутствует | Создать страницу с текстом оферты | P0 |
| 2 | **Проверка и тест email (Resend)** | Без confirm email нет регистрации | Vercel env: `RESEND_API_KEY` | Проверить env, тестовая отправка | P0 |
| 3 | **End-to-end тест оплаты Pally** | Без оплаты нет бизнеса | Pally dashboard + webhook URL | Зарегистрировать webhook, тест-платёж | P0 |
| 4 | **Убрать /support из protectedPaths** | Гость не может написать в поддержку | `middleware.ts` строка 38 | Убрать "/support" из массива | P0 |
| 5 | **Supabase tables в production** | Без таблиц — всё падает | Supabase Dashboard | Прогнать миграции, проверить таблицы | P0 |
| 6 | **RLS политики** | Без RLS пользователь видит чужие данные | Supabase Dashboard | Минимальные RLS для orders, profiles, chat | P0 |
| 7 | **npm run build без ошибок** | Vercel деплой может упасть | Весь проект | Запустить, исправить TypeScript ошибки | P0 |

## 🟠 ВАЖНО (нужно до первых реальных пользователей)

| # | Чего не хватает | Почему важно | Где | Что сделать | Приоритет |
|---|---|---|---|---|---|
| 8 | **site_id в promocodes** | Промокод GPT применится к Spotify | `types/database.ts` + migration | Добавить колонку + migration + фильтр | P1 |
| 9 | **site_id в landing_discounts** | Скидки глобальные — утечка | `types/database.ts` + migration | Добавить колонку | P1 |
| 10 | **Spotify-тарифы в admin** | Менять цены без деплоя невозможно | `lib/content/spotify.ts` → DB | Перенести в site_settings | P1 |
| 11 | **NEXT_PUBLIC_APP_URL в Vercel** | Sitemap/OG с неправильным доменом | Vercel Dashboard | Установить env variable | P1 |
| 12 | **Terms для Subs Store** | Юридически нужен свой agreement | `app/(public)/terms/` | Site-aware или отдельная страница | P1 |

## 🟡 ЖЕЛАТЕЛЬНО (до рекламного трафика)

| # | Что | Где | Приоритет |
|---|---|---|---|
| 13 | Yandex Metrika ID в env | Vercel: `NEXT_PUBLIC_YANDEX_METRIKA_ID` | P2 |
| 14 | Telegram bot токен | Vercel env: `TELEGRAM_BOT_TOKEN` | P2 |
| 15 | Проверка dropdown уведомлений | `app/(admin)/admin/notifications/` | P2 |
| 16 | Favicon + публичные ассеты | `public/` директория | P2 |
| 17 | Мобильный вид обоих лендингов | Runtime тест | P2 |

## 🟢 МОЖНО ПОСЛЕ ЗАПУСКА

| # | Что | Приоритет |
|---|---|---|
| 18 | CryptoCloud второй платёжный провайдер | P3 |
| 19 | Отдельный sitemap для Subs Store | P3 |
| 20 | user_site_access полная реализация в UI | P3 |
| 21 | Аналитика целей в Yandex.Metrika | P3 |
| 22 | Полноценный /admin/sites CRUD | P3 |
| 23 | super_admin в DB enum | P3 |

---

# 9. КРИТИЧЕСКИЕ РИСКИ

## Архитектурные риски

**Риск: filterOrdersBySite() фильтрует по product строке, не по site_id**
- Что случится: Если plan_id не начинается с "spotify" — заказ уйдёт в GPT STORE
- Почему плохо: Смешивание данных двух магазинов в отчётах и кабинете
- Как предотвратить: Всегда устанавливать `site_id` при создании заказа; проверить checkout API

**Риск: store-config.ts работает только для ChatGPT-планов**
- Что случится: Spotify-цены нельзя изменить без деплоя
- Почему плохо: Любое изменение тарифа = деплой + простой
- Как предотвратить: Этап 2 — перенести Spotify-планы в site_settings таблицу

## Технические риски

**Риск: npm run build не запускался**
- Что случится: TypeScript/ESLint ошибки могут блокировать деплой на Vercel
- Почему плохо: Сайт не обновляется при деплое
- Как предотвратить: Запустить `npm run build` немедленно

**Риск: NEXT_PUBLIC_APP_URL не задан**
- Что случится: sitemap.xml и JSON-LD будут содержать `https://subrf.ru` вместо реального домена
- Почему плохо: SEO проблемы, Google индексирует неправильный домен
- Как предотвратить: Добавить в Vercel env прямо сейчас

## Риски безопасности

**Риск: RLS не настроен в Supabase**
- Что случится: Авторизованный пользователь может сделать SELECT на чужие orders через Supabase JS
- Почему плохо: Утечка персональных данных, нарушение закона о персональных данных
- Как предотвратить: Включить RLS на orders, profiles, chat_sessions, chat_messages

**Риск: SUPABASE_SERVICE_ROLE_KEY попадёт в client bundle**
- Что случится: Полный обход RLS из браузера
- Почему плохо: Критическая уязвимость
- Как предотвратить: `createAdminClient()` вызывается только в Server Components / Route Handlers (проверить)

## Риски платежей

**Риск: Pally webhook URL не зарегистрирован**
- Что случится: Оплата висит в статусе `pending` вечно, статус заказа не меняется
- Почему плохо: Клиент заплатил, заказ не активируется, идут чарджбэки и жалобы
- Как предотвратить: Зарегистрировать `https://yourdomain.com/api/payments/pally/webhook` в Pally dashboard

## Риски email/SMTP

**Риск: Supabase auth emails не настроены**
- Что случится: Пользователи не получают confirm signup, не могут завершить регистрацию
- Почему плохо: Конверсия → 0%
- Как предотвратить: Настроить кастомный SMTP (Resend) в Supabase Dashboard → Settings → Auth → SMTP

## Риски смешивания данных

**Риск: Промокоды без site_id**
- Что случится: Промокод для ChatGPT применяется к Spotify-заказу
- Почему плохо: Финансовые потери, неконтролируемые скидки
- Как предотвратить: Добавить site_id в promocodes, фильтровать в checkout API

**Риск: terms/page.tsx захардкожен как "GPT STORE"**
- Что случится: Пользователь Spotify видит соглашение с брендом "GPT STORE"
- Почему плохо: Путаница, нет юридической защиты для Subs Store сервиса
- Как предотвратить: Сделать site-aware или отдельную страницу /spotify/terms

---

# 10. РЕКОМЕНДУЕМЫЙ ПОРЯДОК РАБОТ

```
Этап 1: Стабилизация (прямо сейчас, 2-4 часа)
    ↓
Этап 2: Критические пробелы (1-2 дня)
    ↓
Этап 3: MVP для реальных продаж (2-3 дня)
    ↓
Этап 4: Перед рекламным трафиком (1-2 дня)
    ↓
Этап 5: После запуска (по мере необходимости)
```

---

# 11. ПОДРОБНЫЙ ПЛАН ЭТАПОВ

## ЭТАП 1 — Стабилизация (прямо сейчас)

**Цель:** Убедиться, что проект вообще работает и деплоится

| # | Задача | Файл / Место | Действие |
|---|---|---|---|
| 1.1 | Запустить `npm run build` | terminal | Исправить все TypeScript/ESLint ошибки |
| 1.2 | Проверить все env в Vercel | Vercel Dashboard → Settings → Env | Сравнить с `.env.example` |
| 1.3 | Установить `NEXT_PUBLIC_APP_URL` | Vercel env | Реальный домен сайта |
| 1.4 | Проверить Supabase tables | Supabase → Table Editor | Все 10 таблиц должны существовать |
| 1.5 | Убрать `/support` из protectedPaths | `middleware.ts` строка 38 | Удалить `"/support"` из массива |
| 1.6 | Тестовая регистрация → confirm email | Браузер | Приходит ли письмо? |
| 1.7 | Тестовый вход → редиректы | Браузер | Работают ли роли? |

**Результат:** Проект открывается, регистрация работает, email уходит
**Критерий готовности:** Тест-пользователь прошёл полный путь: register → confirm → login → dashboard

**Затронутые файлы:**
- `middleware.ts`
- Vercel Dashboard (env variables)
- Supabase Dashboard (tables check)

---

## ЭТАП 2 — Критические пробелы

**Цель:** Убрать юридические и data-isolation блокеры

| # | Задача | Файл | Приоритет |
|---|---|---|---|
| 2.1 | Создать страницу `/offer` | `app/(public)/offer/page.tsx` | P0 |
| 2.2 | Добавить /offer в sitemap | `app/sitemap.ts` | P0 |
| 2.3 | Сделать terms site-aware | `app/(public)/terms/page.tsx` | P1 |
| 2.4 | Добавить `site_id` в `promocodes` | Supabase migration + `lib/promocodes/db-promo.ts` | P1 |
| 2.5 | Добавить `site_id` в `landing_discounts` | Supabase migration + `lib/discounts/db-discounts.ts` | P1 |
| 2.6 | End-to-end тест оплаты Pally | Pally dashboard + webhook | P0 |
| 2.7 | Зарегистрировать webhook URL в Pally | Pally account settings | P0 |
| 2.8 | Настроить минимальные RLS политики | Supabase → Authentication → Policies | P0 |

**Результат:** Юридически корректный сайт, оплата работает, данные изолированы

---

## ЭТАП 3 — MVP для реальных продаж

**Цель:** Весь основной flow работает end-to-end

| # | Задача | Файл |
|---|---|---|
| 3.1 | Перенести Spotify-тарифы в `site_settings` | `lib/store-config.ts` + admin settings |
| 3.2 | Проверить мобильный вид обоих лендингов | компоненты `sections/`, `spotify/` |
| 3.3 | Проверить dashboard orders фильтрацию по site | `app/(dashboard)/dashboard/orders/` |
| 3.4 | Настроить Telegram bot | Vercel env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| 3.5 | Проверить admin notifications dropdown | `app/(admin)/admin/notifications/` |
| 3.6 | Favicon + OG image | `public/` директория |
| 3.7 | Тест полного Spotify flow | лендинг → чекаут → оплата → кабинет |

**Результат:** Оба магазина работают, заказы создаются, уведомления приходят

---

## ЭТАП 4 — Перед рекламным трафиком

**Цель:** Готов принимать платный трафик

| # | Задача |
|---|---|
| 4.1 | Yandex.Metrika ID настроен, цели созданы |
| 4.2 | SEO: canonical, OG images для обоих сайтов |
| 4.3 | Cookie banner юридически корректен |
| 4.4 | Все CTA кнопки ведут правильно (ручной QA) |
| 4.5 | Checkout воронка без тупиков (ручной QA) |
| 4.6 | 404 page с правильным брендингом |
| 4.7 | Нагрузочный тест Supabase connection pool |

---

## ЭТАП 5 — После запуска

| # | Задача |
|---|---|
| 5.1 | CryptoCloud второй платёжный провайдер |
| 5.2 | Полный /admin/sites CRUD (добавление новых сайтов) |
| 5.3 | super_admin в DB enum |
| 5.4 | Email маркетинг интеграция |
| 5.5 | Расширенная аналитика (A/B тарифов) |
| 5.6 | Отдельный sitemap для Subs Store |
| 5.7 | user_site_access полная реализация в UI |

---

# 12. ЧТО ДЕЛАТЬ ПРЯМО СЕЙЧАС

> Порядок действий на ближайшие 2–4 часа:

1. ✅ `npm run build` — запустить в терминале, исправить все ошибки
2. ✅ Проверить Vercel env → добавить `NEXT_PUBLIC_APP_URL`
3. ✅ Зайти в Supabase Dashboard → убедиться что все таблицы существуют
4. ✅ Убрать `/support` из `protectedPaths` в `middleware.ts` (строка 38)
5. ✅ Создать страницу `/offer` (оферта)
6. ✅ Добавить `/offer` в `sitemap.ts`
7. ✅ Тестовая регистрация → проверить приходит ли confirm email
8. ✅ Зарегистрировать webhook URL в Pally dashboard

---

# 13. ЧТО МОЖНО ОТЛОЖИТЬ

- CryptoCloud интеграция (Pally достаточно для MVP)
- Полноценный user_site_access UI
- Отдельный sitemap для Subs Store
- super_admin в DB enum (email-based достаточно для одного владельца)
- Аналитика целей Metrika (базовые цели можно добавить после)
- Staff internal chat (не нужен до нескольких операторов)
- Crypto payments (второй провайдер — не критично для старта)

---

# 14. CURSOR-ПРОМПТ ДЛЯ ЭТАПА 1

> Скопируй этот промпт и вставь в Cursor для выполнения первого этапа:

---

```
Ты senior full-stack developer. Работаешь с Next.js 14 + TypeScript + Tailwind + Supabase проектом.

ЗАДАЧА: Выполни 3 конкретных правки в проекте.

=== ПРАВКА 1: Убрать /support из protectedPaths в middleware ===

Файл: middleware.ts
Строка: const protectedPaths = ["/dashboard", "/cabinet", "/admin", "/operator", "/support"];
Действие: Убрать "/support" из массива.
Результат: Неавторизованный пользователь может открыть /support и написать в поддержку.
НЕ ТРОГАЙ: остальные пути в массиве, логику редиректов, cookie handling.

=== ПРАВКА 2: Создать страницу /offer (оферта) ===

Создай файл: app/(public)/offer/page.tsx

Требования:
- Metadata: title="Публичная оферта", description="Условия оказания услуг GPT STORE и Subs Store"
- Структура: скопируй структуру из app/(public)/terms/page.tsx (header с логотипом, main с max-w-3xl)
- Header должен показывать "GPT STORE" с ссылкой на /
- Основной заголовок: "Публичная оферта"
- Подзаголовок: "Условия оказания услуг"
- Текст оферты: заполни разделы (Предмет договора, Стороны, Порядок оплаты, Гарантии, Возврат, Ответственность, Реквизиты).
  Placeholder для реквизитов: "ИП / ООО [НАЗВАНИЕ], ИНН [ИНН], ОГРН [ОГРН]" — оставь как есть, заполнит владелец.
- Футер: используй LandingFooter
- Добавить /offer в sitemap.ts (priority: 0.3, changeFrequency: "yearly")

=== ПРАВКА 3: Добавить site_id в promocodes таблицу (только типы + код) ===

ВАЖНО: Не трогай реальную Supabase migration. Только обнови TypeScript типы и код фильтрации.

3а. Файл: types/database.ts
В таблице promocodes добавь поле site_id: string | null в Row и site_id?: string | null в Insert.

3б. Файл: lib/promocodes/db-promo.ts
Прочитай файл. Найди функцию fetchPromoCodesFromDb (или аналог).
Добавь опциональный параметр siteId?: string.
Если siteId передан — добавь фильтр .or(`site_id.eq.${siteId},site_id.is.null`)
чтобы работали и site-specific и глобальные промокоды.

3в. Файл: lib/store-config.ts
Найди вызов fetchPromoCodesFromDb.
Передай site_id: "gpt-store" (это текущий default).

=== ЧТО НЕ ТРОГАТЬ ===
- Логику авторизации в middleware (только удалить "/support" из массива)
- Pally webhook код
- Supabase client/server setup
- Компоненты лендингов
- Admin layout
- Routing структуру

=== КРИТЕРИИ ГОТОВНОСТИ ===
1. /support открывается без логина
2. /offer открывается и показывает текст оферты
3. /offer есть в sitemap.ts
4. types/database.ts обновлён (site_id в promocodes)
5. TypeScript не показывает новых ошибок в изменённых файлах
6. npm run build проходит (или выведи список ошибок для исправления)
```

---

# ПРИЛОЖЕНИЕ: ПОЛНАЯ КАРТА РОУТОВ

## Публичные страницы
| URL | Файл | Статус |
|---|---|---|
| `/` | `app/(public)/page.tsx` | ✅ |
| `/spotify` | `app/(public)/spotify/page.tsx` | ✅ |
| `/faq` | `app/(public)/faq/page.tsx` | ✅ |
| `/guarantee` | `app/(public)/guarantee/page.tsx` | ✅ |
| `/support` | `app/(public)/support/page.tsx` | ⚠️ требует логина |
| `/reviews` | `app/(public)/reviews/page.tsx` | ✅ |
| `/privacy` | `app/(public)/privacy/page.tsx` | ✅ |
| `/terms` | `app/(public)/terms/page.tsx` | ⚠️ GPT-only бренд |
| `/offer` | — | ❌ отсутствует |

## Auth
| URL | Файл | Статус |
|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | ✅ |
| `/register` | `app/(auth)/register/page.tsx` | ✅ |
| `/callback` | `app/(auth)/callback/page.tsx` | ✅ |
| `/forgot-password` | `app/(auth)/forgot-password/page.tsx` | ✅ |
| `/verify-email` | `app/(auth)/verify-email/page.tsx` | ✅ |
| `/reset-password` | `app/(auth)/reset-password/page.tsx` | ✅ |

## Кабинет пользователя
| URL | Файл | Статус |
|---|---|---|
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | ✅ |
| `/dashboard/orders` | `app/(dashboard)/dashboard/orders/page.tsx` | ✅ |
| `/dashboard/chat` | `app/(dashboard)/dashboard/chat/page.tsx` | ✅ |
| `/dashboard/profile` | `app/(dashboard)/dashboard/profile/page.tsx` | ✅ |
| `/cabinet` | `app/(dashboard)/cabinet/page.tsx` | ✅ (алиас) |

## Чекаут
| URL | Файл | Статус |
|---|---|---|
| `/checkout` | `app/(checkout)/checkout/page.tsx` | ✅ |
| `/checkout/spotify` | `app/(checkout)/checkout/spotify/page.tsx` | ✅ |
| `/checkout/success` | `app/(checkout)/checkout/success/page.tsx` | ✅ |
| `/checkout/fail` | `app/(checkout)/checkout/fail/page.tsx` | ✅ |
| `/checkout/pending` | `app/(checkout)/checkout/pending/page.tsx` | ✅ |

## Админка
| URL | Файл | Статус |
|---|---|---|
| `/admin` | `app/(admin)/admin/page.tsx` | ✅ |
| `/admin/sites` | `app/(admin)/admin/sites/page.tsx` | ✅ |
| `/admin/orders` | `app/(admin)/admin/orders/page.tsx` | ✅ |
| `/admin/clients` | `app/(admin)/admin/clients/page.tsx` | ✅ |
| `/admin/users` | `app/(admin)/admin/users/page.tsx` | ✅ |
| `/admin/chat` | `app/(admin)/admin/chat/page.tsx` | ✅ |
| `/admin/notifications` | `app/(admin)/admin/notifications/page.tsx` | ✅ |
| `/admin/promocodes` | `app/(admin)/admin/promocodes/page.tsx` | ✅ |
| `/admin/discounts` | `app/(admin)/admin/discounts/page.tsx` | ✅ |
| `/admin/reviews` | `app/(admin)/admin/reviews/page.tsx` | ✅ |
| `/admin/settings` | `app/(admin)/admin/settings/page.tsx` | ✅ |

## Оператор
| URL | Файл | Статус |
|---|---|---|
| `/operator` | `app/(operator)/operator/page.tsx` | ✅ |
| `/operator/orders` | `app/(operator)/operator/orders/page.tsx` | ✅ |
| `/operator/clients` | `app/(operator)/operator/clients/page.tsx` | ✅ |
| `/operator/chat` | `app/(operator)/operator/chat/page.tsx` | ✅ |

---

# ПРИЛОЖЕНИЕ: ТАБЛИЦЫ SUPABASE

| Таблица | site_id | Описание |
|---|---|---|
| `profiles` | ❌ | Профили пользователей |
| `orders` | ✅ | Заказы |
| `chat_sessions` | ✅ | Сессии чата |
| `chat_messages` | ❌ | Сообщения (через session_id) |
| `reviews` | ✅ | Отзывы |
| `site_settings` | ❌ | Настройки (по ключу) |
| `sites` | — | Список сайтов |
| `notifications` | ✅ | Уведомления |
| `user_site_access` | ✅ | Доступ пользователей к сайтам |
| `promocodes` | ❌ | **Нет site_id — глобальные** |
| `landing_discounts` | ❌ | **Нет site_id — глобальные** |
| `role_audit` | ❌ | Аудит изменений ролей |

---

*Документ сгенерирован автоматически на основе аудита кодовой базы.*
*Данные, требующие runtime-верификации, отмечены как "Не проверено".*
*Главный администратор: nbuzanov0@mail.ru*
