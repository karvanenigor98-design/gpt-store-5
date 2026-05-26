-- Безопасное расширение: импорт отзывов + идемпотентность платежей
-- Без DROP / DELETE / TRUNCATE

-- GPT reviews: метаданные импорта
alter table public.reviews
  add column if not exists source_file text,
  add column if not exists source text default 'telegram',
  add column if not exists normalized_hash text,
  add column if not exists imported_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists moderation_reason text,
  add column if not exists raw_payload jsonb,
  add column if not exists rating int check (rating is null or (rating >= 1 and rating <= 5));

create index if not exists reviews_normalized_hash_idx on public.reviews (normalized_hash);
create index if not exists reviews_source_file_idx on public.reviews (source_file);
create index if not exists reviews_telegram_date_desc_idx on public.reviews (telegram_date desc nulls last);

-- Дедупликация импорта: один telegram message на файл + сайт
create unique index if not exists reviews_import_dedupe_idx
  on public.reviews (source_file, telegram_message_id, site_id)
  where telegram_message_id is not null and source_file is not null;

create unique index if not exists reviews_normalized_site_dedupe_idx
  on public.reviews (normalized_hash, site_id)
  where normalized_hash is not null and site_id is not null;

-- События платежей (идемпотентность webhook)
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  site_slug text not null,
  order_id text not null,
  provider text not null default 'pally',
  provider_event_id text,
  payment_id text,
  event_type text not null,
  status text not null,
  idempotency_key text not null,
  raw_payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  error_message text
);

create unique index if not exists payment_events_idempotency_idx
  on public.payment_events (provider, idempotency_key);

create index if not exists payment_events_order_idx on public.payment_events (site_slug, order_id);

alter table public.payment_events enable row level security;
