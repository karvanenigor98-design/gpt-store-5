begin;

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'telegram')),
  site_slug text not null check (site_slug in ('gpt-store', 'subs-store')),
  event_type text not null,
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'dead', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_outbox enable row level security;

revoke all on table public.notification_outbox from public, anon, authenticated;
grant all on table public.notification_outbox to service_role;

create index if not exists notification_outbox_due_idx
  on public.notification_outbox (next_attempt_at, created_at)
  where status in ('pending', 'failed');

create index if not exists notification_outbox_processing_idx
  on public.notification_outbox (locked_at)
  where status = 'processing';

create or replace function public.claim_notification_outbox(p_limit integer default 25)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select o.id
    from public.notification_outbox o
    where (
      o.status in ('pending', 'failed')
      and o.next_attempt_at <= now()
    ) or (
      o.status = 'processing'
      and o.locked_at < now() - interval '10 minutes'
    )
    order by o.next_attempt_at asc, o.created_at asc
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  update public.notification_outbox o
  set
    status = 'processing',
    attempts = o.attempts + 1,
    locked_at = now(),
    updated_at = now()
  from candidates
  where o.id = candidates.id
  returning o.*;
end;
$$;

revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;

commit;
