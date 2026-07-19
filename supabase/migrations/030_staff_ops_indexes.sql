-- Safe indexes for staff chat list / search / notifications.
-- Non-destructive. Apply via Supabase SQL Editor or CLI after review.

-- GPT: chat sessions ordered by last message
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message_at
  ON public.chat_sessions (last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_site_last_message
  ON public.chat_sessions (site_id, last_message_at DESC NULLS LAST);

-- GPT: notifications lookup / staff inbox
CREATE INDEX IF NOT EXISTS idx_notifications_site_created
  ON public.notifications (site_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type_entity
  ON public.notifications (type, entity_type, entity_id, created_at DESC);

-- GPT: promocodes by site + code
CREATE INDEX IF NOT EXISTS idx_promocodes_site_code
  ON public.promocodes (site_id, code);

-- GPT: orders account_email search helper
CREATE INDEX IF NOT EXISTS idx_orders_account_email_lower
  ON public.orders (lower(account_email));
