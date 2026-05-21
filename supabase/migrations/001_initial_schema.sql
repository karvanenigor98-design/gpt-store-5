-- ======================================================
-- SubРФ — Первоначальная схема базы данных
-- Запустить в Supabase Dashboard → SQL Editor
-- ============================================================

-- Профили пользователей
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text,
  username      text,
  telegram_id   bigint unique,
  telegram_username text,
  role          text not null default 'client' check (role in ('client', 'operator', 'admin')),
  created_at    timestamptz not null default now(),
  last_seen     timestamptz,
  notes         text,
  tags          text[]
);

-- Автоматически создавать профиль при регистрации
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Заказы
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles on delete set null,
  product           text not null,
  plan_id           text not null,
  price             integer not null,
  currency          text not null default 'RUB',
  payment_method    text,
  payment_provider  text,
  payment_id        text,
  pally_order_id    text,
  status            text not null default 'pending'
    check (status in ('pending','paid','activating','waiting_client','active','failed','refunded','expired')),
  account_email     text,
  token_received_at timestamptz,
  activated_at      timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  meta              jsonb
);

-- Старая БД: таблица orders уже есть без части колонок — CREATE TABLE IF NOT EXISTS её не трогает.
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_id text;
alter table public.orders add column if not exists pally_order_id text;
alter table public.orders add column if not exists account_email text;
alter table public.orders add column if not exists token_received_at timestamptz;
alter table public.orders add column if not exists activated_at timestamptz;
alter table public.orders add column if not exists expires_at timestamptz;
alter table public.orders add column if not exists meta jsonb;

-- Индексы для частых запросов
create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_pally_order_id_idx on public.orders(pally_order_id);

-- Сессии чата
create table if not exists public.chat_sessions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references public.profiles on delete set null,
  type                    text not null default 'operator' check (type in ('operator', 'ai')),
  status                  text not null default 'open' check (status in ('open', 'closed')),
  first_message_at        timestamptz,
  last_operator_reply_at  timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Старая БД: chat_sessions уже есть без части колонок
alter table public.chat_sessions add column if not exists first_message_at timestamptz;
alter table public.chat_sessions add column if not exists last_operator_reply_at timestamptz;
alter table public.chat_sessions add column if not exists updated_at timestamptz not null default now();

create index if not exists chat_sessions_user_id_idx on public.chat_sessions(user_id);
create index if not exists chat_sessions_status_idx on public.chat_sessions(status);

-- Сообщения чата
create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.chat_sessions on delete cascade,
  sender_id    uuid,
  sender_type  text not null check (sender_type in ('client', 'operator', 'ai', 'auto')),
  content      text not null,
  attachments  jsonb,
  is_read      boolean not null default false,
  is_auto_reply boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Старая БД: chat_messages уже есть без session_id и др.
alter table public.chat_messages add column if not exists session_id uuid references public.chat_sessions(id) on delete cascade;
alter table public.chat_messages add column if not exists sender_id uuid;
alter table public.chat_messages add column if not exists sender_type text;
alter table public.chat_messages add column if not exists content text;
alter table public.chat_messages add column if not exists attachments jsonb;
alter table public.chat_messages add column if not exists is_read boolean not null default false;
alter table public.chat_messages add column if not exists is_auto_reply boolean not null default false;
alter table public.chat_messages add column if not exists created_at timestamptz not null default now();

create index if not exists chat_messages_session_id_idx on public.chat_messages(session_id);

-- Отзывы
create table if not exists public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  telegram_message_id bigint unique,
  telegram_chat_id    bigint,
  author_name         text,
  author_username     text,
  author_avatar_url   text,
  content             text not null,
  media_urls          jsonb,
  original_url        text,
  telegram_date       timestamptz,
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists reviews_status_idx on public.reviews(status);

-- Настройки сайта
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Начальные настройки
insert into public.site_settings (key, value) values
  ('auto_reply_delay_minutes', '15'),
  ('operator_telegram_url', '"https://t.me/subrfmanager"'),
  ('night_start_hour', '22'),
  ('night_end_hour', '9')
on conflict (key) do nothing;

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reviews enable row level security;
alter table public.site_settings enable row level security;

-- profiles: пользователь видит свой профиль; admin/operator — все
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- orders: пользователь видит свои заказы; admin/operator — все
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

create policy "orders_select_admin" on public.orders
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);

create policy "orders_update_admin" on public.orders
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

-- chat_sessions: пользователь — свои; operator/admin — все
create policy "sessions_select_own" on public.chat_sessions
  for select using (auth.uid() = user_id);

create policy "sessions_select_admin" on public.chat_sessions
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "sessions_insert_own" on public.chat_sessions
  for insert with check (auth.uid() = user_id);

-- chat_messages: доступ через session
create policy "messages_select" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id
        and (s.user_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator')))
    )
  );

create policy "messages_insert" on public.chat_messages
  for insert with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id
        and (s.user_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator')))
    )
  );

-- reviews: все читают approved; модерация — admin/operator
create policy "reviews_select_approved" on public.reviews
  for select using (status = 'approved');

create policy "reviews_select_admin" on public.reviews
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "reviews_update_admin" on public.reviews
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

-- site_settings: все читают; только admin пишет
create policy "settings_select_all" on public.site_settings
  for select using (true);

create policy "settings_update_admin" on public.site_settings
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ============================================================
-- Realtime включить для трекера статуса заказа
-- ============================================================
-- В Dashboard → Database → Replication → Таблицы включить: orders, chat_messages
