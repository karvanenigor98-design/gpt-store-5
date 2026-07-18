-- Harden notification email idempotency helpers (safe, additive).
-- Does NOT drop data. Unique on outbox already exists (022).
-- Partial unique on email_notification_logs would fail if historical duplicates exist,
-- so we only add a supporting index for active (pending|sent) lookups.

begin;

create index if not exists email_notification_logs_active_dedupe_idx
  on public.email_notification_logs (dedupe_key, created_at desc)
  where dedupe_key is not null
    and status in ('pending', 'sent');

commit;
