-- Chat export audit log (additive, non-destructive).

create table if not exists public.chat_export_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  user_role text not null,
  site_slug text not null,
  chat_id uuid not null,
  export_type text not null check (export_type in ('html', 'zip', 'attachments')),
  date_from timestamptz,
  date_to timestamptz,
  message_count integer not null default 0,
  attachment_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists chat_export_logs_user_id_idx
  on public.chat_export_logs(user_id);

create index if not exists chat_export_logs_chat_id_idx
  on public.chat_export_logs(chat_id);

create index if not exists chat_export_logs_created_at_idx
  on public.chat_export_logs(created_at desc);

alter table public.chat_export_logs enable row level security;

drop policy if exists chat_export_logs_select_staff on public.chat_export_logs;
create policy chat_export_logs_select_staff on public.chat_export_logs
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'operator')
    )
  );
