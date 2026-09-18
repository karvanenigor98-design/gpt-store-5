-- Report + soft unique constraints for unpaid order reuse.
-- IMPORTANT: Do NOT delete existing duplicate orders.
-- Apply unique indexes only after reviewing the report queries below.

-- ===== GPT STORE: duplicate unpaid report (run manually, read-only) =====
-- select user_id, plan_id, count(*) as cnt, array_agg(id order by created_at) as order_ids
-- from public.orders
-- where status in ('pending', 'awaiting_payment')
--   and user_id is not null
--   and plan_id is not null
-- group by user_id, plan_id
-- having count(*) > 1;

-- Soft unique: at most one unpaid order per (user_id, plan_id).
-- Will FAIL if duplicates already exist — fix/report first, then re-run.
create unique index if not exists orders_one_unpaid_per_user_plan_idx
  on public.orders (user_id, plan_id)
  where status in ('pending', 'awaiting_payment')
    and user_id is not null
    and plan_id is not null;
