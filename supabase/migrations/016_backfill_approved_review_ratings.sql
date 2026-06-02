-- One-time backfill: legacy approved reviews without rating (already applied on prod GPT DB).
-- Safe to re-run: only touches rows with null rating.

update public.reviews
set
  rating = 5,
  published_at = coalesce(published_at, updated_at, created_at, now()),
  updated_at = now()
where status in ('approved', 'published')
  and rating is null;
