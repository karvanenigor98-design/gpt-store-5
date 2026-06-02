-- Subs Store chat: reply + soft-delete.
-- Safe schema extension only.

alter table public.chat_messages
  add column if not exists reply_to_message_id uuid null;

alter table public.chat_messages
  add column if not exists is_deleted boolean not null default false;

alter table public.chat_messages
  add column if not exists deleted_at timestamptz null;

alter table public.chat_messages
  add column if not exists deleted_by uuid null;

create index if not exists subs_chat_messages_reply_to_idx
  on public.chat_messages(reply_to_message_id);

create index if not exists subs_chat_messages_is_deleted_idx
  on public.chat_messages(is_deleted);
