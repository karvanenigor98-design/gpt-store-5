-- Реферальная программа (GPT Store Supabase)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_lower_idx
  ON public.profiles (lower(referral_code))
  WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referral_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  referee_discount_percent integer NOT NULL DEFAULT 10 CHECK (referee_discount_percent BETWEEN 1 AND 90),
  referrer_discount_percent integer NOT NULL DEFAULT 10 CHECK (referrer_discount_percent BETWEEN 1 AND 90),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.referral_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rewarded')),
  first_order_id uuid,
  referee_promo_code text,
  referrer_promo_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at timestamptz
);

CREATE INDEX IF NOT EXISTS referral_events_referrer_idx ON public.referral_events (referrer_user_id);

ALTER TABLE public.promocodes
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_event_id uuid REFERENCES public.referral_events(id) ON DELETE SET NULL;
