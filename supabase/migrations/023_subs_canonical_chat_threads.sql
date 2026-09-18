begin;

-- Spotify/Subs: merge duplicate open threads, fix last_message_at, uniqueness + trigger.

update public.chat_threads t
set last_message_at = coalesce(m.last_message_at, t.created_at)
from (
  select thread_id, max(created_at) as last_message_at
  from public.chat_messages
  group by thread_id
) m
where m.thread_id = t.id;

update public.chat_threads
set last_message_at = created_at
where last_message_at is null;

create temporary table _chat_thread_merge_map (
  duplicate_id uuid primary key,
  canonical_id uuid not null
) on commit drop;

-- Duplicate open threads per user_id
insert into _chat_thread_merge_map (duplicate_id, canonical_id)
select id, canonical_id
from (
  select
    id,
    first_value(id) over (
      partition by user_id
      order by last_message_at desc nulls last, created_at desc, id desc
    ) as canonical_id,
    row_number() over (
      partition by user_id
      order by last_message_at desc nulls last, created_at desc, id desc
    ) as position
  from public.chat_threads
  where status = 'open'
    and user_id is not null
) ranked
where position > 1
on conflict do nothing;

-- Duplicate open threads per order_id (email-only / no user)
insert into _chat_thread_merge_map (duplicate_id, canonical_id)
select id, canonical_id
from (
  select
    id,
    first_value(id) over (
      partition by order_id
      order by last_message_at desc nulls last, created_at desc, id desc
    ) as canonical_id,
    row_number() over (
      partition by order_id
      order by last_message_at desc nulls last, created_at desc, id desc
    ) as position
  from public.chat_threads
  where status = 'open'
    and user_id is null
    and order_id is not null
) ranked
where position > 1
on conflict do nothing;

update public.chat_messages m
set thread_id = map.canonical_id
from _chat_thread_merge_map map
where m.thread_id = map.duplicate_id;

update public.notifications n
set entity_id = map.canonical_id
from _chat_thread_merge_map map
where n.entity_id = map.duplicate_id
  and n.entity_type in ('chat', 'chat_thread', 'support_chat');

delete from public.chat_threads t
using _chat_thread_merge_map map
where t.id = map.duplicate_id;

update public.chat_threads t
set last_message_at = coalesce(stats.last_message_at, t.created_at)
from (
  select thread_id, max(created_at) as last_message_at
  from public.chat_messages
  group by thread_id
) stats
where stats.thread_id = t.id;

create unique index if not exists chat_threads_one_open_per_user_idx
  on public.chat_threads (user_id)
  where status = 'open' and user_id is not null;

create unique index if not exists chat_threads_one_open_per_order_idx
  on public.chat_threads (order_id)
  where status = 'open' and user_id is null and order_id is not null;

create index if not exists chat_threads_open_activity_idx
  on public.chat_threads (last_message_at desc)
  where status = 'open';

create index if not exists chat_messages_thread_created_idx
  on public.chat_messages (thread_id, created_at desc);

create or replace function public.touch_chat_thread_last_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.chat_threads
  set
    last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
    updated_at = greatest(coalesce(updated_at, new.created_at), new.created_at)
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_thread on public.chat_messages;
create trigger chat_messages_touch_thread
after insert on public.chat_messages
for each row execute function public.touch_chat_thread_last_message();

commit;
