-- Subs Store Supabase: per-staff read tracking (run in Subs project SQL editor).
create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists notification_reads_user_id_idx on public.notification_reads (user_id);
