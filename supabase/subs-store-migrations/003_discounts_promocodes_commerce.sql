-- Spotify Store (РѕС‚РґРµР»СЊРЅС‹Р№ Supabase): СЃРєРёРґРєРё РЅР° РІРёС‚СЂРёРЅСѓ + РїСЂРѕРјРѕРєРѕРґС‹ РЅР° checkout.
-- Р’С‹РїРѕР»РЅРёС‚СЊ РІ SQL Editor РїСЂРѕРµРєС‚Р° Spotify Store.

CREATE TABLE IF NOT EXISTS public.discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'percent' CHECK (type IN ('percent', 'fixed')),
  value integer NOT NULL CHECK (value > 0),
  tariff_slugs text[],
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promocodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  type text NOT NULL DEFAULT 'percent' CHECK (type IN ('percent', 'fixed')),
  value integer NOT NULL CHECK (value > 0),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  tariff_slugs text[],
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS promocodes_code_lower_idx ON public.promocodes (lower(code));

ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS tariff_slugs text[];
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS value integer;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS ends_at timestamptz;
ALTER TABLE public.discounts ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.promocodes ADD COLUMN IF NOT EXISTS tariff_slugs text[];
ALTER TABLE public.promocodes ADD COLUMN IF NOT EXISTS used_count integer DEFAULT 0;
ALTER TABLE public.promocodes ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.promocodes ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

