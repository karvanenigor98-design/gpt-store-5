-- Fix RLS recursion on profiles used by Realtime.
-- Root cause: staff policies queried public.profiles inside public.profiles policy,
-- which can recurse under realtime.apply_rls (42P17).

create or replace function public.current_user_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'operator')
  );
$$;

revoke all on function public.current_user_is_staff() from public;
grant execute on function public.current_user_is_staff() to authenticated;
grant execute on function public.current_user_is_staff() to anon;

alter policy profiles_select_admin
  on public.profiles
  using (public.current_user_is_staff());

alter policy orders_select_admin
  on public.orders
  using (public.current_user_is_staff());

alter policy orders_update_admin
  on public.orders
  using (public.current_user_is_staff());

alter policy sessions_select_admin
  on public.chat_sessions
  using (public.current_user_is_staff());

alter policy notifications_select_admin_op
  on public.notifications
  using (public.current_user_is_staff());

alter policy notifications_update_admin
  on public.notifications
  using (public.current_user_is_staff());

alter policy notification_reads_admin
  on public.notification_reads
  using (public.current_user_is_staff())
  with check (public.current_user_is_staff());

alter policy reviews_select_admin
  on public.reviews
  using (public.current_user_is_staff());

alter policy reviews_update_admin
  on public.reviews
  using (public.current_user_is_staff());

alter policy analytics_select_admin
  on public.analytics_events
  using (public.current_user_is_staff());

alter policy chat_export_logs_select_staff
  on public.chat_export_logs
  using (public.current_user_is_staff());

alter policy email_campaign_logs_admin_select
  on public.email_campaign_logs
  using (public.current_user_is_staff());

alter policy scheduled_email_jobs_admin_select
  on public.scheduled_email_jobs
  using (public.current_user_is_staff());

alter policy messages_select
  on public.chat_messages
  using (
    exists (
      select 1
      from public.chat_sessions s
      where s.id = chat_messages.session_id
        and (
          (s.type = 'staff' and (auth.uid() = s.user_id or auth.uid() = s.staff_peer_id))
          or (
            s.type in ('operator', 'ai')
            and (
              s.user_id = auth.uid()
              or public.current_user_is_staff()
            )
          )
        )
    )
  );

alter policy messages_insert
  on public.chat_messages
  with check (
    exists (
      select 1
      from public.chat_sessions s
      where s.id = chat_messages.session_id
        and (
          (s.type = 'staff' and (auth.uid() = s.user_id or auth.uid() = s.staff_peer_id))
          or (
            s.type in ('operator', 'ai')
            and (
              s.user_id = auth.uid()
              or public.current_user_is_staff()
            )
          )
        )
    )
  );
