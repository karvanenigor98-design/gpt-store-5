-- Backfill approved GPT STORE reviews: rating, published_at, site_id (idempotent).
-- Applied on prod gbtstore 2026-06-03.

update public.reviews
set
  rating = coalesce(rating, 5),
  published_at = coalesce(published_at, updated_at, created_at, now()),
  site_id = coalesce(site_id, (select id from public.sites where slug = 'gpt-store' limit 1)),
  updated_at = now()
where status in ('approved', 'published');
