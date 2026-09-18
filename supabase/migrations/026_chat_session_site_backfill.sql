-- Safe re-backfill / re-merge for GPT operator chat sessions.
-- Moves messages from duplicate sessions into canonical, then removes empty dup session rows.
-- Does NOT delete chat_messages content.

begin;

-- 1) Backfill null site_id → gpt-store
update public.chat_sessions cs
set site_id = s.id
from public.sites s
where cs.type = 'operator'
  and cs.site_id is null
  and s.slug = 'gpt-store';

-- 2) Refresh last_message_at from messages
update public.chat_sessions cs
set last_message_at = coalesce(m.last_message_at, cs.created_at)
from (
  select session_id, max(created_at) as last_message_at
  from public.chat_messages
  group by session_id
) m
where m.session_id = cs.id
  and (
    cs.last_message_at is null
    or cs.last_message_at < m.last_message_at
  );

-- 3) Merge duplicate operator sessions per (user_id, site_id)
create temporary table _chat_session_merge_map_026 (
  duplicate_id uuid primary key,
  canonical_id uuid not null
) on commit drop;

insert into _chat_session_merge_map_026 (duplicate_id, canonical_id)
select id, canonical_id
from (
  select
    id,
    first_value(id) over (
      partition by user_id, site_id
      order by last_message_at desc nulls last, created_at desc, id desc
    ) as canonical_id,
    row_number() over (
      partition by user_id, site_id
      order by last_message_at desc nulls last, created_at desc, id desc
    ) as position
  from public.chat_sessions
  where type = 'operator'
    and user_id is not null
    and site_id is not null
) ranked
where position > 1;

update public.chat_messages m
set session_id = map.canonical_id
from _chat_session_merge_map_026 map
where m.session_id = map.duplicate_id;

update public.notifications n
set entity_id = map.canonical_id
from _chat_session_merge_map_026 map
where n.entity_id = map.duplicate_id
  and n.entity_type in ('chat', 'chat_session', 'support_chat');

-- Remove empty duplicate session shells (messages already moved).
delete from public.chat_sessions cs
using _chat_session_merge_map_026 map
where cs.id = map.duplicate_id;

create unique index if not exists chat_sessions_one_operator_per_user_site_idx
  on public.chat_sessions (user_id, site_id)
  where type = 'operator' and user_id is not null and site_id is not null;

commit;
