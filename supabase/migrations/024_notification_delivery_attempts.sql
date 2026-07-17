begin;

create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  outbox_id uuid not null references public.notification_outbox(id) on delete cascade,
  attempt_no integer not null check (attempt_no >= 1),
  channel text not null check (channel in ('email', 'telegram')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  provider_response text,
  created_at timestamptz not null default now()
);

alter table public.notification_delivery_attempts enable row level security;

revoke all on table public.notification_delivery_attempts from public, anon, authenticated;
grant all on table public.notification_delivery_attempts to service_role;

create index if not exists notification_delivery_attempts_outbox_idx
  on public.notification_delivery_attempts (outbox_id, created_at desc);

commit;
