-- ============================================================
-- Migration 010: email notification logs + per-site settings
-- SAFE: CREATE IF NOT EXISTS, no destructive ops
-- Run in Supabase Dashboard → SQL Editor (GPT STORE project)
-- ============================================================

create table if not exists public.email_notification_settings (
  site_slug   text primary key,
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

insert into public.email_notification_settings (site_slug, settings)
values
  ('gpt-store', '{
    "enabled_clients": true,
    "enabled_admins": true,
    "enabled_operators": true,
    "enabled_chat": true,
    "enabled_orders": true,
    "enabled_reviews": true,
    "enabled_payments": true,
    "enabled_promocodes": true
  }'::jsonb),
  ('subs-store', '{
    "enabled_clients": true,
    "enabled_admins": true,
    "enabled_operators": true,
    "enabled_chat": true,
    "enabled_orders": true,
    "enabled_reviews": true,
    "enabled_payments": true,
    "enabled_promocodes": true
  }'::jsonb)
on conflict (site_slug) do nothing;

create table if not exists public.email_notification_logs (
  id                  uuid primary key default gen_random_uuid(),
  site_slug           text not null,
  recipient_user_id   uuid,
  recipient_email     text not null,
  recipient_role      text check (recipient_role in ('client', 'admin', 'operator', 'staff')),
  event_type          text not null,
  related_entity_type text,
  related_entity_id   text,
  subject             text not null,
  preview             text,
  status              text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  error_message       text,
  dedupe_key          text,
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists email_notification_logs_site_idx
  on public.email_notification_logs (site_slug, created_at desc);

create index if not exists email_notification_logs_dedupe_idx
  on public.email_notification_logs (dedupe_key)
  where dedupe_key is not null;

create index if not exists email_notification_logs_status_idx
  on public.email_notification_logs (status, created_at desc);

-- Staff site access: optional per-user email opt-out
alter table public.user_site_access
  add column if not exists can_receive_email_notifications boolean not null default true;

-- Allow chat_reply in notifications CHECK (app already inserts it)
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'new_order', 'payment_success', 'payment_failed',
  'new_chat_message', 'new_review', 'chat_reply',
  'order_needs_data', 'order_problem', 'order_activated',
  'subscription_expiring'
));

alter table public.email_notification_settings enable row level security;
alter table public.email_notification_logs enable row level security;

create policy "email_settings_admin_select" on public.email_notification_settings
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "email_settings_admin_update" on public.email_notification_settings
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "email_logs_admin_select" on public.email_notification_logs
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );
