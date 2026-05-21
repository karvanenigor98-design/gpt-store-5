-- ============================================================
-- Multi-site архитектура — безопасное расширение
-- Миграция 005: таблица sites, site_id в существующих таблицах,
--               notifications, user_site_access, analytics_events
--
-- БЕЗОПАСНО: все новые колонки nullable, данные не удаляются
-- Запустить в Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Таблица sites (магазины/лендинги)
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

-- Вставляем два дефолтных сайта
insert into public.sites (slug, brand_name, product_type, support_telegram, support_email, primary_color, accent_color, seo_title)
values
  ('gpt-store',   'GPT STORE',   'chatgpt', '@subrfmanager',  'nbuzanov0@mail.ru', '#10a37f', '#10a37f', 'GPT STORE — ChatGPT Plus без иностранной карты'),
  ('subs-store',  'Subs Store',  'spotify', '@subs_support',  'nbuzanov0@mail.ru', '#1DB954', '#1DB954', 'Subs Store — Spotify Premium в России')
on conflict (slug) do nothing;

-- ============================================================
-- 2. Добавляем site_id в существующие таблицы (nullable → safe)
-- ============================================================

-- orders.site_id
alter table public.orders
  add column if not exists site_id uuid references public.sites(id) on delete set null;

-- Проставляем site_id для существующих заказов на основе product поля
-- GPT STORE заказы
update public.orders o
set site_id = s.id
from public.sites s
where s.slug = 'gpt-store'
  and o.site_id is null
  and (o.product like 'chatgpt%' or o.product not like 'spotify%');

-- Spotify/Subs Store заказы
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

-- Все существующие отзывы считаем GPT STORE (из Telegram канала)
update public.reviews r
set site_id = s.id
from public.sites s
where s.slug = 'gpt-store'
  and r.site_id is null;

create index if not exists reviews_site_id_idx on public.reviews(site_id);

-- ============================================================
-- 3. Уведомления (notifications)
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
-- 4. Доступы операторов/админов к сайтам
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
-- 5. Аналитика событий
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
-- 6. RLS политики
-- ============================================================

-- sites: все читают активные; только admin пишет
alter table public.sites enable row level security;

create policy "sites_select_all" on public.sites
  for select using (is_active = true or
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "sites_modify_admin" on public.sites
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- notifications: пользователь видит свои; admin/operator видят по role и site
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

-- Разрешаем вставку уведомлений service role (через admin client)
create policy "notifications_insert_service" on public.notifications
  for insert with check (true);

-- user_site_access: admin видит всё, пользователь видит свои записи
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

-- analytics_events: только admin/operator читают; service role пишет
alter table public.analytics_events enable row level security;

create policy "analytics_select_admin" on public.analytics_events
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "analytics_insert_service" on public.analytics_events
  for insert with check (true);

-- ============================================================
-- 7. Функция защиты super_admin от понижения роли
-- ============================================================
create or replace function public.protect_super_admin()
returns trigger language plpgsql security definer as $$
begin
  -- Блокируем только понижение с admin; разрешаем client→admin и правки других полей
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
-- 8. Realtime включить для notifications
-- ============================================================
-- В Supabase Dashboard → Database → Replication → включить таблицу notifications

-- ============================================================
-- Проверка после выполнения:
-- SELECT slug, brand_name FROM public.sites;
-- SELECT count(*) FROM public.orders WHERE site_id IS NOT NULL;
-- SELECT count(*) FROM public.orders WHERE site_id IS NULL;
-- ============================================================
