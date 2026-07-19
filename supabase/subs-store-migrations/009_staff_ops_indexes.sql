-- Subs Store: safe indexes for chat list / notifications / search.
-- Non-destructive.

CREATE INDEX IF NOT EXISTS idx_chat_threads_last_message_at
  ON public.chat_threads (last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_chat_threads_status_last_message
  ON public.chat_threads (status, last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_subs_notifications_recipient_created
  ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subs_notifications_type_entity
  ON public.notifications (type, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subs_orders_account_email_lower
  ON public.orders (lower(account_email));

CREATE INDEX IF NOT EXISTS idx_subs_promocodes_code
  ON public.promocodes (code);
