-- ============================================================
-- Migration 006: site_memberships + site_id for discounts/promocodes
-- Tracks which sites each customer has registered with.
-- Uses text slug (not UUID FK) for simplicity and independence.
--
-- SAFE: new table, new nullable columns, no destructive ops.
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. site_memberships table (customer site registration)
-- ============================================================
create table if not exists public.site_memberships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  site_slug   text not null,
  role        text not null default 'customer'
                check (role in ('customer', 'operator', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, site_slug)
);

create index if not exists site_memberships_user_idx on public.site_memberships(user_id);
create index if not exists site_memberships_site_idx on public.site_memberships(site_slug);

-- RLS: users see their own memberships; admin sees all
alter table public.site_memberships enable row level security;

create policy "site_memberships_select_own" on public.site_memberships
  for select using (user_id = auth.uid());

create policy "site_memberships_select_admin" on public.site_memberships
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "site_memberships_insert_service" on public.site_memberships
  for insert with check (true);

create policy "site_memberships_upsert_service" on public.site_memberships
  for update using (true);

-- ============================================================
-- 2. Backfill memberships for existing users from orders
-- ============================================================
-- GPT Store customers: users with non-spotify orders
insert into public.site_memberships (user_id, site_slug, role)
select distinct o.user_id, 'gpt-store', 'customer'
from public.orders o
where o.user_id is not null
  and (o.product not like 'spotify%' or o.product is null)
  and not exists (
    select 1 from public.profiles p
    where p.id = o.user_id and p.role in ('admin', 'operator')
  )
on conflict (user_id, site_slug) do nothing;

-- Subs Store customers: users with spotify orders
insert into public.site_memberships (user_id, site_slug, role)
select distinct o.user_id, 'subs-store', 'customer'
from public.orders o
where o.user_id is not null
  and o.product like 'spotify%'
  and not exists (
    select 1 from public.profiles p
    where p.id = o.user_id and p.role in ('admin', 'operator')
  )
on conflict (user_id, site_slug) do nothing;

-- ============================================================
-- 3. site_id (text slug) for landing_discounts
-- ============================================================
alter table public.landing_discounts
  add column if not exists site_id text default 'gpt-store';

update public.landing_discounts
set site_id = 'gpt-store'
where site_id is null;

create index if not exists idx_landing_discounts_site_id
  on public.landing_discounts(site_id);

-- ============================================================
-- 4. site_id (text slug) for promocodes
-- ============================================================
alter table public.promocodes
  add column if not exists site_id text default 'gpt-store';

update public.promocodes
set site_id = 'gpt-store'
where site_id is null;

create index if not exists idx_promocodes_site_id
  on public.promocodes(site_id);

-- ============================================================
-- 5. Verify
-- ============================================================
-- SELECT count(*) FROM public.site_memberships;
-- SELECT site_slug, count(*) FROM public.site_memberships GROUP BY site_slug;
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'landing_discounts' AND column_name = 'site_id';
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'promocodes' AND column_name = 'site_id';
