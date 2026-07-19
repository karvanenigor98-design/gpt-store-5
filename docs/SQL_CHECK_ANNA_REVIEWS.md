# Investigate «Анна» review rows (read-only)

Large «Анна» on Spotify landing was a **UI bug** (`h2` = featured author name) + mock `SPOTIFY_REVIEWS`, not necessarily a DB row.

Before deleting anything, run SELECT only.

## Subs Supabase

```sql
SELECT id, name, text, status, is_published, created_at
FROM public.reviews
WHERE name ILIKE 'анна%'
   OR name = 'Анна'
ORDER BY created_at DESC
LIMIT 50;
```

Delete **only** if confirmed test/fake and not a real customer review:

```sql
-- DO NOT RUN until you verified rows above are fake
-- DELETE FROM public.reviews WHERE id IN ('...');
```

Prefer reject/unpublish over delete:

```sql
UPDATE public.reviews
SET status = 'rejected', is_published = false
WHERE id IN ('...');
```

## GPT Supabase

```sql
SELECT id, author_name, content, status, published_at, created_at
FROM public.reviews
WHERE author_name ILIKE 'анна%'
ORDER BY created_at DESC
LIMIT 50;
```
