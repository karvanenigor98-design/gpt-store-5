-- Safe backfill: set tariffs.duration_months from slug when NULL.
-- Does NOT modify orders or expires_at.
-- Apply on Subs Store Supabase project.

update public.tariffs
set duration_months = 12
where duration_months is null
  and slug ~* '-(12)m$';

update public.tariffs
set duration_months = 6
where duration_months is null
  and slug ~* '-(6)m$';

update public.tariffs
set duration_months = 3
where duration_months is null
  and slug ~* '-(3)m$';

update public.tariffs
set duration_months = 1
where duration_months is null
  and slug ~* '-(1)m$';

-- Generic title fallbacks when slug has no -Nm suffix
update public.tariffs
set duration_months = 12
where duration_months is null
  and title ~* '(12\s*мес|год)';

update public.tariffs
set duration_months = 3
where duration_months is null
  and title ~* '3\s*мес';

update public.tariffs
set duration_months = 1
where duration_months is null
  and title ~* '(^|\s)1\s*мес|^месяц';
