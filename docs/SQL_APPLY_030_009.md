# Safe indexes — apply manually

## Why
Staff chat list / search / notifications sort and filter without full-table scans.

## GPT Supabase (main project)
File: `supabase/migrations/030_staff_ops_indexes.sql`

Tables: `chat_sessions`, `notifications`, `promocodes`, `orders`

Risks: low — `CREATE INDEX IF NOT EXISTS` only. Brief write lock while index builds on large tables.

Rollback:
```sql
DROP INDEX IF EXISTS idx_chat_sessions_last_message_at;
DROP INDEX IF EXISTS idx_chat_sessions_site_last_message;
DROP INDEX IF EXISTS idx_notifications_site_created;
DROP INDEX IF EXISTS idx_notifications_type_entity;
DROP INDEX IF EXISTS idx_promocodes_site_code;
DROP INDEX IF EXISTS idx_orders_account_email_lower;
```

## Subs Supabase
File: `supabase/subs-store-migrations/009_staff_ops_indexes.sql`

Tables: `chat_threads`, `notifications`, `orders`, `promocodes`

Rollback: drop the indexes named in that file with `DROP INDEX IF EXISTS`.

## How
1. Supabase Dashboard → SQL Editor
2. Paste file contents
3. Run
4. Confirm no errors
