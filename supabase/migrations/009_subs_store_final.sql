-- ============================================================
-- Migration 009: Spotify Store final setup
-- Idempotent вЂ” safe to run multiple times.
-- Run in: Supabase Dashboard -> SQL Editor -> paste -> Run
-- ============================================================

-- 1. Ensure sites table exists
CREATE TABLE IF NOT EXISTS public.sites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE,
  brand_name   text NOT NULL DEFAULT '',
  product_type text NOT NULL DEFAULT 'chatgpt',
  support_telegram text DEFAULT '',
  support_email    text DEFAULT '',
  primary_color    text DEFAULT '#10a37f',
  accent_color     text DEFAULT '#10a37f',
  seo_title        text DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed both sites (idempotent)
INSERT INTO public.sites (slug, brand_name, product_type, support_telegram, support_email, primary_color, accent_color, seo_title)
VALUES
  ('gpt-store',  'GPT STORE',  'chatgpt', '@subrfmanager', 'nbuzanov0@mail.ru', '#10a37f', '#10a37f', 'GPT STORE - ChatGPT Plus bez inostrannoj karty'),
  ('subs-store', 'Spotify Store', 'spotify',  '@subs_support', 'nbuzanov0@mail.ru', '#1DB954', '#1DB954', 'Spotify Store - Spotify Premium v Rossii')
ON CONFLICT (slug) DO UPDATE
  SET brand_name       = EXCLUDED.brand_name,
      product_type     = EXCLUDED.product_type,
      support_telegram = EXCLUDED.support_telegram,
      support_email    = EXCLUDED.support_email,
      primary_color    = EXCLUDED.primary_color,
      accent_color     = EXCLUDED.accent_color,
      seo_title        = EXCLUDED.seo_title,
      updated_at       = now();

-- 3. Ensure site_memberships table exists
CREATE TABLE IF NOT EXISTS public.site_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_slug  text NOT NULL,
  role       text NOT NULL DEFAULT 'customer'
               CHECK (role IN ('customer', 'operator', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, site_slug)
);

CREATE INDEX IF NOT EXISTS site_memberships_user_idx ON public.site_memberships(user_id);
CREATE INDEX IF NOT EXISTS site_memberships_site_idx ON public.site_memberships(site_slug);

ALTER TABLE public.site_memberships ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'site_memberships' AND policyname = 'site_memberships_select_own'
  ) THEN
    CREATE POLICY "site_memberships_select_own" ON public.site_memberships
      FOR SELECT USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'site_memberships' AND policyname = 'site_memberships_select_admin'
  ) THEN
    CREATE POLICY "site_memberships_select_admin" ON public.site_memberships
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'site_memberships' AND policyname = 'site_memberships_insert_service'
  ) THEN
    CREATE POLICY "site_memberships_insert_service" ON public.site_memberships
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'site_memberships' AND policyname = 'site_memberships_upsert_service'
  ) THEN
    CREATE POLICY "site_memberships_upsert_service" ON public.site_memberships
      FOR UPDATE USING (true);
  END IF;
END $$;

-- 4. Ensure orders.site_id column exists (UUID FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'site_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN site_id uuid REFERENCES public.sites(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_site_id ON public.orders(site_id);

-- 5. Ensure chat_sessions.site_id column exists (UUID FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_sessions' AND column_name = 'site_id'
  ) THEN
    ALTER TABLE public.chat_sessions ADD COLUMN site_id uuid REFERENCES public.sites(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_site_id ON public.chat_sessions(site_id);

-- 6. Ensure promocodes.site_id is TEXT slug (not UUID)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promocodes' AND column_name = 'site_id'
  ) THEN
    ALTER TABLE public.promocodes ADD COLUMN site_id text NOT NULL DEFAULT 'gpt-store';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promocodes'
      AND column_name = 'site_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.promocodes DROP CONSTRAINT IF EXISTS promocodes_site_id_fkey;
    ALTER TABLE public.promocodes ALTER COLUMN site_id TYPE text USING 'gpt-store';
    ALTER TABLE public.promocodes ALTER COLUMN site_id SET DEFAULT 'gpt-store';
  END IF;
  UPDATE public.promocodes SET site_id = 'gpt-store' WHERE site_id IS NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_promocodes_site_id ON public.promocodes(site_id);

-- 7. Ensure landing_discounts.site_id is TEXT slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'landing_discounts' AND column_name = 'site_id'
  ) THEN
    ALTER TABLE public.landing_discounts ADD COLUMN site_id text NOT NULL DEFAULT 'gpt-store';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'landing_discounts'
      AND column_name = 'site_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.landing_discounts DROP CONSTRAINT IF EXISTS landing_discounts_site_id_fkey;
    ALTER TABLE public.landing_discounts ALTER COLUMN site_id TYPE text USING 'gpt-store';
    ALTER TABLE public.landing_discounts ALTER COLUMN site_id SET DEFAULT 'gpt-store';
  END IF;
  UPDATE public.landing_discounts SET site_id = 'gpt-store' WHERE site_id IS NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_landing_discounts_site_id ON public.landing_discounts(site_id);

-- 8. Backfill orders.site_id from product field
UPDATE public.orders o
SET site_id = s.id
FROM public.sites s
WHERE s.slug = 'gpt-store'
  AND o.site_id IS NULL
  AND (o.product NOT LIKE 'spotify%' OR o.product IS NULL);

UPDATE public.orders o
SET site_id = s.id
FROM public.sites s
WHERE s.slug = 'subs-store'
  AND o.site_id IS NULL
  AND o.product LIKE 'spotify%';

-- 9. Backfill chat_sessions.site_id
UPDATE public.chat_sessions cs
SET site_id = s.id
FROM public.sites s
WHERE s.slug = 'gpt-store'
  AND cs.site_id IS NULL
  AND cs.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = cs.user_id AND o.product LIKE 'spotify%'
  );

UPDATE public.chat_sessions cs
SET site_id = s.id
FROM public.sites s
WHERE s.slug = 'subs-store'
  AND cs.site_id IS NULL
  AND cs.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = cs.user_id AND o.product LIKE 'spotify%'
  );

-- 10. Backfill site_memberships from orders
INSERT INTO public.site_memberships (user_id, site_slug, role)
SELECT DISTINCT o.user_id, 'gpt-store', 'customer'
FROM public.orders o
WHERE o.user_id IS NOT NULL
  AND (o.product NOT LIKE 'spotify%' OR o.product IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = o.user_id AND p.role IN ('admin', 'operator')
  )
ON CONFLICT (user_id, site_slug) DO NOTHING;

INSERT INTO public.site_memberships (user_id, site_slug, role)
SELECT DISTINCT o.user_id, 'subs-store', 'customer'
FROM public.orders o
WHERE o.user_id IS NOT NULL
  AND o.product LIKE 'spotify%'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = o.user_id AND p.role IN ('admin', 'operator')
  )
ON CONFLICT (user_id, site_slug) DO NOTHING;

-- 11. Ensure super admin has memberships for both sites
INSERT INTO public.site_memberships (user_id, site_slug, role)
SELECT p.id, 'gpt-store', 'admin'
FROM public.profiles p
WHERE p.email = 'nbuzanov0@mail.ru'
ON CONFLICT (user_id, site_slug) DO UPDATE SET role = 'admin', updated_at = now();

INSERT INTO public.site_memberships (user_id, site_slug, role)
SELECT p.id, 'subs-store', 'admin'
FROM public.profiles p
WHERE p.email = 'nbuzanov0@mail.ru'
ON CONFLICT (user_id, site_slug) DO UPDATE SET role = 'admin', updated_at = now();

-- ============================================================
-- Verify after running:
--   SELECT slug, id FROM public.sites ORDER BY slug;
--   SELECT site_slug, count(*) FROM public.site_memberships GROUP BY site_slug;
--   SELECT count(*) FROM public.orders WHERE site_id IS NOT NULL;
-- ============================================================

