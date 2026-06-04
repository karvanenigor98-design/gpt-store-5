-- Safe backfill: staff (admin/operator) in GPT profiles → site_memberships for both stores.
-- Fixes operators who see only GPT STORE in the admin switcher (missing subs-store row).
-- No DELETE/TRUNCATE. Idempotent.

INSERT INTO public.site_memberships (user_id, site_slug, role)
SELECT p.id, 'gpt-store',
  CASE WHEN p.role = 'admin' THEN 'admin' ELSE 'operator' END
FROM public.profiles p
WHERE p.role IN ('admin', 'operator')
  AND NOT EXISTS (
    SELECT 1 FROM public.site_memberships sm
    WHERE sm.user_id = p.id AND sm.site_slug = 'gpt-store'
  )
ON CONFLICT (user_id, site_slug) DO UPDATE
  SET role = EXCLUDED.role, updated_at = now();

INSERT INTO public.site_memberships (user_id, site_slug, role)
SELECT p.id, 'subs-store',
  CASE WHEN p.role = 'admin' THEN 'admin' ELSE 'operator' END
FROM public.profiles p
WHERE p.role IN ('admin', 'operator')
  AND NOT EXISTS (
    SELECT 1 FROM public.site_memberships sm
    WHERE sm.user_id = p.id AND sm.site_slug = 'subs-store'
  )
ON CONFLICT (user_id, site_slug) DO UPDATE
  SET role = EXCLUDED.role, updated_at = now();

-- Target operator from ticket (idempotent)
INSERT INTO public.site_memberships (user_id, site_slug, role)
SELECT p.id, 'subs-store', 'operator'
FROM public.profiles p
WHERE lower(trim(p.email)) = 'andreihavronicheff@yandex.ru'
  AND p.role = 'operator'
ON CONFLICT (user_id, site_slug) DO UPDATE
  SET role = 'operator', updated_at = now();
