-- Safe: add CRM stage column if missing (no data loss).
alter table public.profiles
  add column if not exists client_stage text;

comment on column public.profiles.client_stage is
  'CRM stage: purchased, waiting, no_purchase, needs_help, other';

create index if not exists profiles_client_stage_idx
  on public.profiles (client_stage)
  where client_stage is not null;
