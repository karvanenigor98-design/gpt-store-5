-- Subs Store: soft unique for unpaid orders.
-- Do NOT delete existing duplicates. Review report first:

-- select lower(customer_email) as email, tariff_id, count(*) as cnt,
--        array_agg(id order by created_at) as order_ids
-- from public.orders
-- where status in ('awaiting_payment', 'pending', 'new', 'pending_payment_setup')
--   and customer_email is not null
--   and tariff_id is not null
-- group by 1, 2
-- having count(*) > 1;

create unique index if not exists orders_one_unpaid_per_email_tariff_idx
  on public.orders (lower(customer_email), tariff_id)
  where status in ('awaiting_payment', 'pending', 'new', 'pending_payment_setup')
    and customer_email is not null
    and tariff_id is not null;
