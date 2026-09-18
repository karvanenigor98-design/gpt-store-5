begin;

create unique index if not exists payment_events_idempotency_key_idx
  on public.payment_events (idempotency_key);

create index if not exists payment_events_order_status_idx
  on public.payment_events (site_slug, order_id, status, payment_id);

commit;
