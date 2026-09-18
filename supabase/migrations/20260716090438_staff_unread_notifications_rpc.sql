begin;

create index if not exists notifications_staff_inbox_created_idx
  on public.notifications (created_at desc)
  where type in (
    'new_order',
    'payment_success',
    'payment_failed',
    'new_chat_message',
    'new_review',
    'order_needs_data',
    'order_problem',
    'order_activated',
    'subscription_expiring'
  );

create index if not exists notification_reads_user_notif_idx
  on public.notification_reads (user_id, notification_id);

create or replace function public.count_staff_unread_notifications(
  p_auth_user_id uuid,
  p_reads_user_id uuid,
  p_role text,
  p_site_slug text,
  p_shared_inbox_user_id uuid default null,
  p_gpt_site_id uuid default null,
  p_subs_site_id uuid default null
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if p_auth_user_id is null or p_reads_user_id is null then
    return 0;
  end if;
  if p_role not in ('admin', 'operator') then
    return 0;
  end if;

  select count(*)::integer into v_count
  from public.notifications n
  where n.type in (
      'new_order',
      'payment_success',
      'payment_failed',
      'new_chat_message',
      'new_review',
      'order_needs_data',
      'order_problem',
      'order_activated',
      'subscription_expiring'
    )
    and coalesce(n.recipient_role, '') is distinct from 'client'
    and (
      n.recipient_user_id = p_auth_user_id
      or (
        p_shared_inbox_user_id is not null
        and n.recipient_user_id = p_shared_inbox_user_id
      )
      or (
        n.recipient_user_id is null
        and (
          n.recipient_role is null
          or n.recipient_role = p_role
          or (n.recipient_role = 'admin' and p_role = 'admin')
        )
      )
    )
    and (
      p_site_slug <> 'gpt-store'
      or p_gpt_site_id is null
      or n.site_id = p_gpt_site_id
      or n.site_id = p_subs_site_id
      or n.site_id is null
    )
    and not exists (
      select 1
      from public.notification_reads r
      where r.user_id = p_reads_user_id
        and r.notification_id = n.id
    )
    and not (
      n.recipient_user_id = p_auth_user_id
      and coalesce(n.is_read, false) = true
      and n.type not in (
        'new_order',
        'payment_success',
        'payment_failed',
        'new_chat_message',
        'new_review',
        'order_needs_data',
        'order_problem',
        'order_activated',
        'subscription_expiring'
      )
    );

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.count_staff_unread_notifications(
  uuid, uuid, text, text, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.count_staff_unread_notifications(
  uuid, uuid, text, text, uuid, uuid, uuid
) to service_role;

commit;
