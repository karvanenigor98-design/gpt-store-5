-- Migration 011: scheduled unpaid-order reminders + email campaign logs
-- SAFE: CREATE IF NOT EXISTS, no destructive ops

create table if not exists public.scheduled_email_jobs (
  id              uuid primary key default gen_random_uuid(),
  site_slug       text not null check (site_slug in ('gpt-store', 'subs-store')),
  order_id        text not null,
  event_type      text not null default 'awaiting_payment_reminder',
  recipient_email text not null,
  scheduled_at    timestamptz not null,
  status          text not null default 'pending'
    check (status in ('pending', 'sent', 'cancelled', 'skipped')),
  dedupe_key      text unique,
  metadata        jsonb default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index if not exists scheduled_email_jobs_pending_idx
  on public.scheduled_email_jobs (status, scheduled_at)
  where status = 'pending';

create table if not exists public.email_campaign_logs (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     text not null,
  site_slug       text not null,
  recipient_email text not null,
  order_id        text,
  status          text not null check (status in ('sent', 'failed', 'skipped', 'duplicate')),
  error_message   text,
  created_at      timestamptz not null default now()
);

create index if not exists email_campaign_logs_campaign_idx
  on public.email_campaign_logs (campaign_id, created_at desc);

alter table public.scheduled_email_jobs enable row level security;
alter table public.email_campaign_logs enable row level security;

create policy "scheduled_email_jobs_admin_select" on public.scheduled_email_jobs
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "email_campaign_logs_admin_select" on public.email_campaign_logs
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );
