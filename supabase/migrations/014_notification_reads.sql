-- Per-user read state for staff broadcast notifications (recipient_user_id IS NULL).
-- Safe: CREATE IF NOT EXISTS only.

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create index if not exists notification_reads_user_id_idx on public.notification_reads (user_id);

alter table public.notification_reads enable row level security;

drop policy if exists "notification_reads_select_own" on public.notification_reads;
create policy "notification_reads_select_own" on public.notification_reads
  for select using (auth.uid() = user_id);

drop policy if exists "notification_reads_insert_own" on public.notification_reads;
create policy "notification_reads_insert_own" on public.notification_reads
  for insert with check (auth.uid() = user_id);

drop policy if exists "notification_reads_admin" on public.notification_reads;
create policy "notification_reads_admin" on public.notification_reads
  for all using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'operator')
    )
  );
