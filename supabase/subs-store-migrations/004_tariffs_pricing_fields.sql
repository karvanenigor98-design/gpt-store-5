-- Spotify Store: РїРѕР»СЏ С‚Р°СЂРёС„РѕРІ РґР»СЏ РІРёС‚СЂРёРЅС‹ Рё Р°РґРјРёРЅРєРё (Р±РµР· destructive SQL).
-- Р’С‹РїРѕР»РЅРёС‚СЊ РІ SQL Editor РїСЂРѕРµРєС‚Р° Spotify Store.

ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS duration_months integer;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS old_price integer;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS monthly_price integer;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS savings_text text;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS is_popular boolean NOT NULL DEFAULT false;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS is_best_value boolean NOT NULL DEFAULT false;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS cta_text text;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS allow_promocodes boolean NOT NULL DEFAULT true;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS allow_discounts boolean NOT NULL DEFAULT true;
ALTER TABLE public.tariffs ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS tariffs_category_sort_idx ON public.tariffs (category, sort_order);
CREATE INDEX IF NOT EXISTS tariffs_flags_idx ON public.tariffs (is_popular, is_best_value) WHERE is_active = true;

