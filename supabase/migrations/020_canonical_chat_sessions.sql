begin;

alter table public.chat_sessions
  add column if not exists last_message_at timestamptz;

update public.chat_sessions cs
set site_id = s.id
from public.sites s
where cs.type = 'operator'
  and cs.site_id is null
  and s.slug = 'gpt-store';

update public.chat_sessions cs
set last_message_at = coalesce(m.last_message_at, cs.created_at)
from (
  select session_id, max(created_at) as last_message_at
  from public.chat_messages
  group by session_id
) m
where m.session_id = cs.id;

update public.chat_sessions
set last_message_at = created_at
where last_message_at is null;

create temporary table _chat_session_merge_map (
  duplicate_id uuid primary key,
  canonical_id uuid not null
) on commit drop;

insert into _chat_session_merge_map (duplicate_id, canonical_id)
select id, canonical_id
from (
  select
    id,
    first_value(id) over (
      partition by user_id, site_id
      order by last_message_at desc, created_at desc, id desc
    ) as canonical_id,
    row_number() over (
      partition by user_id, site_id
      order by last_message_at desc, created_at desc, id desc
    ) as position
  from public.chat_sessions
  where type = 'operator'
    and user_id is not null
    and site_id is not null
) ranked
where position > 1;

update public.chat_messages m
set session_id = map.canonical_id
from _chat_session_merge_map map
where m.session_id = map.duplicate_id;

update public.notifications n
set entity_id = map.canonical_id
from _chat_session_merge_map map
where n.entity_id = map.duplicate_id
  and n.entity_type in ('chat', 'chat_session', 'support_chat');

do $$
begin
  if to_regclass('public.chat_export_logs') is not null then
    update public.chat_export_logs l
    set chat_id = map.canonical_id
    from _chat_session_merge_map map
    where l.chat_id = map.duplicate_id;
  end if;
end $$;

delete from public.chat_sessions cs
using _chat_session_merge_map map
where cs.id = map.duplicate_id;

update public.chat_sessions cs
set
  first_message_at = stats.first_client_message_at,
  last_operator_reply_at = stats.last_staff_message_at,
  last_message_at = coalesce(stats.last_message_at, cs.created_at),
  updated_at = greatest(cs.updated_at, coalesce(stats.last_message_at, cs.created_at))
from (
  select
    session_id,
    min(created_at) filter (where sender_type = 'client') as first_client_message_at,
    max(created_at) filter (where sender_type in ('operator', 'admin')) as last_staff_message_at,
    max(created_at) as last_message_at
  from public.chat_messages
  group by session_id
) stats
where stats.session_id = cs.id;

create unique index if not exists chat_sessions_one_operator_per_user_site_idx
  on public.chat_sessions (user_id, site_id)
  where type = 'operator' and user_id is not null and site_id is not null;

create index if not exists chat_sessions_operator_site_activity_idx
  on public.chat_sessions (site_id, last_message_at desc)
  where type = 'operator';

create index if not exists chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at desc);

create index if not exists chat_messages_unread_client_idx
  on public.chat_messages (session_id)
  where sender_type = 'client' and is_read = false;

create or replace function public.touch_chat_session_last_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.chat_sessions
  set
    last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at),
    updated_at = greatest(updated_at, new.created_at),
    first_message_at = case
      when new.sender_type = 'client' then coalesce(first_message_at, new.created_at)
      else first_message_at
    end,
    last_operator_reply_at = case
      when new.sender_type in ('operator', 'admin') then new.created_at
      else last_operator_reply_at
    end
  where id = new.session_id;
  return new;
end;
$$;

revoke all on function public.touch_chat_session_last_message() from public, anon, authenticated;
grant execute on function public.touch_chat_session_last_message() to service_role;

drop trigger if exists chat_messages_touch_session on public.chat_messages;
create trigger chat_messages_touch_session
after insert on public.chat_messages
for each row execute function public.touch_chat_session_last_message();

commit;
