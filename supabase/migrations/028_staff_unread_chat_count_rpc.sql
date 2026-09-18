-- Fast unread client-message count for staff nav badges (GPT Store).
-- Avoids pulling all session ids into the app layer.

create index if not exists chat_messages_unread_client_session_idx
  on public.chat_messages (session_id)
  where sender_type = 'client' and is_read = false;

create or replace function public.count_gpt_unread_client_chat_messages(
  p_site_id uuid default null,
  p_exclude_site_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.chat_messages m
  inner join public.chat_sessions s on s.id = m.session_id
  where s.type = 'operator'
    and s.status = 'open'
    and m.sender_type = 'client'
    and m.is_read = false
    and (
      p_site_id is null
      or s.site_id = p_site_id
      or s.site_id is null
    )
    and (
      p_exclude_site_id is null
      or s.site_id is distinct from p_exclude_site_id
    );
$$;

revoke all on function public.count_gpt_unread_client_chat_messages(uuid, uuid) from public;
grant execute on function public.count_gpt_unread_client_chat_messages(uuid, uuid) to service_role;
