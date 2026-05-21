-- ============================================================
-- Migration 007: Fix site_id column types for promocodes and landing_discounts
--
-- PROBLEM:
--   Migration 006_site_memberships added TEXT site_id on promocodes/landing_discounts.
--   Migration 006_tariffs_and_faq_supplement tried to add UUID FK site_id on the same tables.
--   Depending on which ran first, the column type may be inconsistent.
--
--   Application code uses TEXT slug (gpt-store / subs-store) for these tables —
--   this is intentional and correct (simpler, no UUID FK dependency).
--
-- FIX:
--   Ensure site_id on promocodes and landing_discounts is TEXT (not UUID).
--   If the column is already TEXT with default 'gpt-store', this is a no-op.
--   If the column is UUID, safely convert to TEXT preserving existing data.
--
-- SAFE: uses IF EXISTS checks, no data deleted, backward compatible.
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. Fix promocodes.site_id to be TEXT
-- ============================================================

DO $$
BEGIN
  -- Check if site_id column exists on promocodes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'promocodes'
      AND column_name = 'site_id'
  ) THEN
    -- Column doesn't exist yet — add it as TEXT
    ALTER TABLE public.promocodes
      ADD COLUMN site_id text NOT NULL DEFAULT 'gpt-store';

  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'promocodes'
      AND column_name = 'site_id'
      AND data_type = 'uuid'
  ) THEN
    -- Column exists as UUID (from 006_tariffs_and_faq_supplement) — convert to TEXT
    -- First drop the FK constraint if it exists
    ALTER TABLE public.promocodes
      DROP CONSTRAINT IF EXISTS promocodes_site_id_fkey;
    -- Change type to text
    ALTER TABLE public.promocodes
      ALTER COLUMN site_id TYPE text USING 'gpt-store';
    ALTER TABLE public.promocodes
      ALTER COLUMN site_id SET DEFAULT 'gpt-store';
  END IF;

  -- Backfill NULLs
  UPDATE public.promocodes SET site_id = 'gpt-store' WHERE site_id IS NULL;
END $$;

-- Ensure index exists
DROP INDEX IF EXISTS idx_promocodes_site_id;
DROP INDEX IF EXISTS promocodes_site_id_idx;
CREATE INDEX IF NOT EXISTS idx_promocodes_site_id ON public.promocodes(site_id);


-- ============================================================
-- 2. Fix landing_discounts.site_id to be TEXT
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'landing_discounts'
      AND column_name = 'site_id'
  ) THEN
    ALTER TABLE public.landing_discounts
      ADD COLUMN site_id text NOT NULL DEFAULT 'gpt-store';

  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'landing_discounts'
      AND column_name = 'site_id'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.landing_discounts
      DROP CONSTRAINT IF EXISTS landing_discounts_site_id_fkey;
    ALTER TABLE public.landing_discounts
      ALTER COLUMN site_id TYPE text USING 'gpt-store';
    ALTER TABLE public.landing_discounts
      ALTER COLUMN site_id SET DEFAULT 'gpt-store';
  END IF;

  UPDATE public.landing_discounts SET site_id = 'gpt-store' WHERE site_id IS NULL;
END $$;

DROP INDEX IF EXISTS idx_landing_discounts_site_id;
DROP INDEX IF EXISTS landing_discounts_site_id_idx;
CREATE INDEX IF NOT EXISTS idx_landing_discounts_site_id ON public.landing_discounts(site_id);


-- ============================================================
-- 3. Ensure sites table is seeded with both stores
-- ============================================================

INSERT INTO public.sites (slug, brand_name, product_type, support_telegram, support_email, primary_color, accent_color, seo_title)
VALUES
  ('gpt-store',  'GPT STORE',  'chatgpt', '@subrfmanager', 'nbuzanov0@mail.ru', '#10a37f', '#10a37f', 'GPT STORE — ChatGPT Plus без иностранной карты'),
  ('subs-store', 'Subs Store', 'spotify',  '@subs_support',  'nbuzanov0@mail.ru', '#1DB954', '#1DB954', 'Subs Store — Spotify Premium в России')
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- 4. Backfill orders.site_id using product prefix (if not already done)
-- ============================================================

-- GPT STORE orders (non-spotify)
UPDATE public.orders o
SET site_id = s.id
FROM public.sites s
WHERE s.slug = 'gpt-store'
  AND o.site_id IS NULL
  AND (o.product NOT LIKE 'spotify%' OR o.product IS NULL);

-- Subs Store / Spotify orders
UPDATE public.orders o
SET site_id = s.id
FROM public.sites s
WHERE s.slug = 'subs-store'
  AND o.site_id IS NULL
  AND o.product LIKE 'spotify%';


-- ============================================================
-- 5. Backfill site_memberships from orders (if table exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT to_regclass('public.site_memberships')) THEN
    -- GPT Store customers from orders
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

    -- Subs Store customers from orders
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
  END IF;
END $$;


-- ============================================================
-- 6. Backfill chat_sessions.site_id from orders (if orders have site_id)
-- ============================================================

-- Tag existing gpt-store chat sessions (those without site_id and user has gpt-store order)
UPDATE public.chat_sessions cs
SET site_id = s.id
FROM public.sites s
WHERE s.slug = 'gpt-store'
  AND cs.site_id IS NULL
  AND cs.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = cs.user_id
      AND o.product NOT LIKE 'spotify%'
  );

-- Tag subs-store chat sessions
UPDATE public.chat_sessions cs
SET site_id = s.id
FROM public.sites s
WHERE s.slug = 'subs-store'
  AND cs.site_id IS NULL
  AND cs.user_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = cs.user_id
      AND o.product LIKE 'spotify%'
  );


-- ============================================================
-- 7. Ensure site_memberships table exists (if 006 not applied)
-- ============================================================

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


-- ============================================================
-- Verify after running:
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name IN ('promocodes', 'landing_discounts')
--   AND column_name = 'site_id';
-- -- Should return: text / text
--
-- SELECT slug, id FROM public.sites;
-- -- Should return 2 rows: gpt-store and subs-store
--
-- SELECT site_slug, count(*) FROM public.site_memberships GROUP BY site_slug;
-- -- Should show customer counts per site
-- ============================================================
