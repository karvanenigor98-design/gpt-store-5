begin;

update public.chat_threads t
set
  last_message_at = coalesce(stats.last_message_at, t.created_at),
  updated_at = greatest(t.updated_at, coalesce(stats.last_message_at, t.created_at))
from (
  select thread_id, max(created_at) as last_message_at
  from public.chat_messages
  group by thread_id
) stats
where stats.thread_id = t.id;

create index if not exists chat_threads_activity_idx
  on public.chat_threads (last_message_at desc, created_at desc);

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at desc);

create index if not exists chat_messages_unread_customer_idx
  on public.chat_messages (thread_id)
  where author_role = 'customer' and read_at is null;

create or replace function public.touch_chat_thread_last_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.chat_threads
  set
    last_message_at = greatest(last_message_at, new.created_at),
    updated_at = greatest(updated_at, new.created_at)
  where id = new.thread_id;
  return new;
end;
$$;

revoke all on function public.touch_chat_thread_last_message() from public, anon, authenticated;
grant execute on function public.touch_chat_thread_last_message() to service_role;

drop trigger if exists chat_messages_touch_thread on public.chat_messages;
create trigger chat_messages_touch_thread
after insert on public.chat_messages
for each row execute function public.touch_chat_thread_last_message();

commit;
