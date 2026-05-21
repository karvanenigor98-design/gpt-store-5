# Миграции для Supabase Subs Store (проект spotify)

Эти SQL **не** применяются к GPT-проекту автоматически. Скопируйте файл в **Supabase Dashboard → SQL → New query** проекта Subs Store и выполните.

| Файл | Назначение |
|------|------------|
| `001_role_audit.sql` | Аудит смены ролей в админке (`?site=subs-store`) |
| `002_profiles_telegram_username.sql` | Колонка `profiles.telegram_username` для админки и профиля клиента |
| `003_discounts_promocodes_commerce.sql` | Таблицы `discounts` / `promocodes` + `tariff_slugs` для синхронизации с лендингом |

**Автопроверка:** `npm run subs:db:telegram-username` — проверит колонку в Subs Supabase; при наличии `SUPABASE_ACCESS_TOKEN` в `.env.local` применит миграцию сам, иначе выведет SQL для SQL Editor.
