-- ============================================================
-- Multi-site Р°СЂС…РёС‚РµРєС‚СѓСЂР° вЂ” Р±РµР·РѕРїР°СЃРЅРѕРµ СЂР°СЃС€РёСЂРµРЅРёРµ
-- РњРёРіСЂР°С†РёСЏ 005: С‚Р°Р±Р»РёС†Р° sites, site_id РІ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… С‚Р°Р±Р»РёС†Р°С…,
--               notifications, user_site_access, analytics_events
--
-- Р‘Р•Р—РћРџРђРЎРќРћ: РІСЃРµ РЅРѕРІС‹Рµ РєРѕР»РѕРЅРєРё nullable, РґР°РЅРЅС‹Рµ РЅРµ СѓРґР°Р»СЏСЋС‚СЃСЏ
-- Р—Р°РїСѓСЃС‚РёС‚СЊ РІ Supabase Dashboard в†’ SQL Editor
-- ============================================================

-- ============================================================
-- 1. РўР°Р±Р»РёС†Р° sites (РјР°РіР°Р·РёРЅС‹/Р»РµРЅРґРёРЅРіРё)
-- ============================================================
create table if not exists public.sites (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  brand_name      text not null,
  product_type    text not null default 'chatgpt',
  support_telegram text,
  support_email   text,
  primary_color   text default '#10a37f',
  accent_color    text default '#10a37f',
  seo_title       text,
  seo_description text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Р’СЃС‚Р°РІР»СЏРµРј РґРІР° РґРµС„РѕР»С‚РЅС‹С… СЃР°Р№С‚Р°
insert into public.sites (slug, brand_name, product_type, support_telegram, support_email, primary_color, accent_color, seo_title)
values
  ('gpt-store',   'GPT STORE',   'chatgpt', '@subrfmanager',  'nbuzanov0@mail.ru', '#10a37f', '#10a37f', 'GPT STORE вЂ” ChatGPT Plus Р±РµР· РёРЅРѕСЃС‚СЂР°РЅРЅРѕР№ РєР°СЂС‚С‹'),
  ('subs-store',  'Spotify Store',  'spotify', '@subs_support',  'nbuzanov0@mail.ru', '#1DB954', '#1DB954', 'Spotify Store вЂ” Spotify Premium РІ Р РѕСЃСЃРёРё')
on conflict (slug) do nothing;

-- ============================================================
-- 2. Р”РѕР±Р°РІР»СЏРµРј site_id РІ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ С‚Р°Р±Р»РёС†С‹ (nullable в†’ safe)
-- ============================================================

-- orders.site_id
alter table public.orders
  add column if not exists site_id uuid references public.sites(id) on delete set null;

-- РџСЂРѕСЃС‚Р°РІР»СЏРµРј site_id РґР»СЏ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёС… Р·Р°РєР°Р·РѕРІ РЅР° РѕСЃРЅРѕРІРµ product РїРѕР»СЏ
-- GPT STORE Р·Р°РєР°Р·С‹
update public.orders o
set site_id = s.id
from public.sites s
where s.slug = 'gpt-store'
  and o.site_id is null
  and (o.product like 'chatgpt%' or o.product not like 'spotify%');

-- Spotify/Spotify Store Р·Р°РєР°Р·С‹
update public.orders o
set site_id = s.id
from public.sites s
where s.slug = 'subs-store'
  and o.site_id is null
  and o.product like 'spotify%';

create index if not exists orders_site_id_idx on public.orders(site_id);

-- chat_sessions.site_id
alter table public.chat_sessions
  add column if not exists site_id uuid references public.sites(id) on delete set null;

create index if not exists chat_sessions_site_id_idx on public.chat_sessions(site_id);

-- reviews.site_id
alter table public.reviews
  add column if not exists site_id uuid references public.sites(id) on delete set null;

-- Р’СЃРµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РѕС‚Р·С‹РІС‹ СЃС‡РёС‚Р°РµРј GPT STORE (РёР· Telegram РєР°РЅР°Р»Р°)
update public.reviews r
set site_id = s.id
from public.sites s
where s.slug = 'gpt-store'
  and r.site_id is null;

create index if not exists reviews_site_id_idx on public.reviews(site_id);

-- ============================================================
-- 3. РЈРІРµРґРѕРјР»РµРЅРёСЏ (notifications)
-- ============================================================
create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid references public.sites(id) on delete cascade,
  recipient_user_id uuid references public.profiles(id) on delete cascade,
  recipient_role    text check (recipient_role in ('admin', 'operator', 'client')),
  type              text not null check (type in (
    'new_order', 'payment_success', 'payment_failed',
    'new_chat_message', 'new_review',
    'order_needs_data', 'order_problem', 'order_activated',
    'subscription_expiring'
  )),
  title             text not null,
  message           text not null,
  entity_type       text,
  entity_id         uuid,
  is_read           boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists notifications_site_id_idx on public.notifications(site_id);
create index if not exists notifications_recipient_idx on public.notifications(recipient_user_id);
create index if not exists notifications_is_read_idx on public.notifications(is_read);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);

-- ============================================================
-- 4. Р”РѕСЃС‚СѓРїС‹ РѕРїРµСЂР°С‚РѕСЂРѕРІ/Р°РґРјРёРЅРѕРІ Рє СЃР°Р№С‚Р°Рј
-- ============================================================
create table if not exists public.user_site_access (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  site_id     uuid not null references public.sites(id) on delete cascade,
  role        text not null check (role in ('admin', 'operator')),
  granted_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique(user_id, site_id)
);

create index if not exists user_site_access_user_idx on public.user_site_access(user_id);
create index if not exists user_site_access_site_idx on public.user_site_access(site_id);

-- ============================================================
-- 5. РђРЅР°Р»РёС‚РёРєР° СЃРѕР±С‹С‚РёР№
-- ============================================================
create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid references public.sites(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  session_id  text,
  event_type  text not null,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists analytics_events_site_id_idx on public.analytics_events(site_id);
create index if not exists analytics_events_user_id_idx on public.analytics_events(user_id);
create index if not exists analytics_events_type_idx on public.analytics_events(event_type);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at desc);

-- ============================================================
-- 6. RLS РїРѕР»РёС‚РёРєРё
-- ============================================================

-- sites: РІСЃРµ С‡РёС‚Р°СЋС‚ Р°РєС‚РёРІРЅС‹Рµ; С‚РѕР»СЊРєРѕ admin РїРёС€РµС‚
alter table public.sites enable row level security;

create policy "sites_select_all" on public.sites
  for select using (is_active = true or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "sites_modify_admin" on public.sites
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- notifications: РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РІРёРґРёС‚ СЃРІРѕРё; admin/operator РІРёРґСЏС‚ РїРѕ role Рё site
alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
  for select using (recipient_user_id = auth.uid());

create policy "notifications_select_admin_op" on public.notifications
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "notifications_update_own" on public.notifications
  for update using (recipient_user_id = auth.uid());

create policy "notifications_update_admin" on public.notifications
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

-- Р Р°Р·СЂРµС€Р°РµРј РІСЃС‚Р°РІРєСѓ СѓРІРµРґРѕРјР»РµРЅРёР№ service role (С‡РµСЂРµР· admin client)
create policy "notifications_insert_service" on public.notifications
  for insert with check (true);

-- user_site_access: admin РІРёРґРёС‚ РІСЃС‘, РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РІРёРґРёС‚ СЃРІРѕРё Р·Р°РїРёСЃРё
alter table public.user_site_access enable row level security;

create policy "user_site_access_select_own" on public.user_site_access
  for select using (user_id = auth.uid());

create policy "user_site_access_select_admin" on public.user_site_access
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "user_site_access_modify_admin" on public.user_site_access
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- analytics_events: С‚РѕР»СЊРєРѕ admin/operator С‡РёС‚Р°СЋС‚; service role РїРёС€РµС‚
alter table public.analytics_events enable row level security;

create policy "analytics_select_admin" on public.analytics_events
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "analytics_insert_service" on public.analytics_events
  for insert with check (true);

-- ============================================================
-- 7. Р¤СѓРЅРєС†РёСЏ Р·Р°С‰РёС‚С‹ super_admin РѕС‚ РїРѕРЅРёР¶РµРЅРёСЏ СЂРѕР»Рё
-- ============================================================
create or replace function public.protect_super_admin()
returns trigger language plpgsql security definer as $$
begin
  -- Р‘Р»РѕРєРёСЂСѓРµРј С‚РѕР»СЊРєРѕ РїРѕРЅРёР¶РµРЅРёРµ СЃ admin; СЂР°Р·СЂРµС€Р°РµРј clientв†’admin Рё РїСЂР°РІРєРё РґСЂСѓРіРёС… РїРѕР»РµР№
  if lower(old.email) = lower('nbuzanov0@mail.ru')
     and old.role = 'admin'
     and new.role is distinct from 'admin' then
    raise exception 'Main super admin cannot be downgraded';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_super_admin_trigger on public.profiles;
create trigger protect_super_admin_trigger
  before update on public.profiles
  for each row execute function public.protect_super_admin();

-- ============================================================
-- 8. Realtime РІРєР»СЋС‡РёС‚СЊ РґР»СЏ notifications
-- ============================================================
-- Р’ Supabase Dashboard в†’ Database в†’ Replication в†’ РІРєР»СЋС‡РёС‚СЊ С‚Р°Р±Р»РёС†Сѓ notifications

-- ============================================================
-- РџСЂРѕРІРµСЂРєР° РїРѕСЃР»Рµ РІС‹РїРѕР»РЅРµРЅРёСЏ:
-- SELECT slug, brand_name FROM public.sites;
-- SELECT count(*) FROM public.orders WHERE site_id IS NOT NULL;
-- SELECT count(*) FROM public.orders WHERE site_id IS NULL;
-- ============================================================

