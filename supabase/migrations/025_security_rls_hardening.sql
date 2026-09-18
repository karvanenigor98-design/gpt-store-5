-- Security hardening (safe, additive) for GPT + Spotify schemas.

begin;

-- ── Restrict WITH CHECK (true) / USING (true) policies to service_role ──

do $$
begin
  if to_regclass('public.analytics_events') is not null then
    drop policy if exists analytics_insert_service on public.analytics_events;
    create policy analytics_insert_service
      on public.analytics_events
      for insert
      to service_role
      with check (true);
  end if;

  if to_regclass('public.notifications') is not null then
    drop policy if exists notifications_insert_service on public.notifications;
    create policy notifications_insert_service
      on public.notifications
      for insert
      to service_role
      with check (true);
  end if;

  if to_regclass('public.site_memberships') is not null then
    drop policy if exists site_memberships_insert_service on public.site_memberships;
    create policy site_memberships_insert_service
      on public.site_memberships
      for insert
      to service_role
      with check (true);

    drop policy if exists site_memberships_upsert_service on public.site_memberships;
    create policy site_memberships_upsert_service
      on public.site_memberships
      for update
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- ── SECURITY DEFINER RPC surface ──

do $$
begin
  if to_regprocedure('public.handle_new_user()') is not null then
    revoke all on function public.handle_new_user() from public, anon, authenticated;
    grant execute on function public.handle_new_user() to service_role;
  end if;
  if to_regprocedure('public.protect_super_admin()') is not null then
    revoke all on function public.protect_super_admin() from public, anon, authenticated;
    grant execute on function public.protect_super_admin() to service_role;
    alter function public.protect_super_admin() set search_path = public;
  end if;
  if to_regprocedure('public.current_user_is_staff()') is not null then
    revoke all on function public.current_user_is_staff() from public, anon;
    grant execute on function public.current_user_is_staff() to authenticated, service_role;
  end if;
  if to_regprocedure('public.is_admin()') is not null then
    revoke all on function public.is_admin() from public, anon;
    grant execute on function public.is_admin() to authenticated, service_role;
  end if;
  if to_regprocedure('public.is_staff()') is not null then
    revoke all on function public.is_staff() from public, anon;
    grant execute on function public.is_staff() to authenticated, service_role;
  end if;
  if to_regprocedure('public.protect_main_super_admin()') is not null then
    revoke all on function public.protect_main_super_admin() from public, anon, authenticated;
    grant execute on function public.protect_main_super_admin() to service_role;
    alter function public.protect_main_super_admin() set search_path = public;
  end if;
end $$;

-- ── Performance indexes ──

do $$
begin
  if to_regclass('public.profiles') is not null then
    create index if not exists profiles_role_created_at_idx
      on public.profiles (role, created_at desc);
    create index if not exists profiles_created_at_idx
      on public.profiles (created_at desc);
  end if;
  if to_regclass('public.orders') is not null then
    create index if not exists orders_user_id_created_at_idx
      on public.orders (user_id, created_at desc);
  end if;
  if to_regclass('public.chat_messages') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'chat_messages' and column_name = 'deleted_by'
     ) then
    create index if not exists chat_messages_deleted_by_idx
      on public.chat_messages (deleted_by)
      where deleted_by is not null;
  end if;
end $$;

commit;
