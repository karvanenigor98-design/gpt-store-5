-- Spotify Store (РѕС‚РґРµР»СЊРЅС‹Р№ Supabase-РїСЂРѕРµРєС‚ В«spotifyВ»)
-- Р’С‹РїРѕР»РЅРёС‚СЊ РІ SQL Editor СЌС‚РѕРіРѕ РїСЂРѕРµРєС‚Р°, РµСЃР»Рё С‚Р°Р±Р»РёС†С‹ role_audit РµС‰С‘ РЅРµС‚.
-- Р‘РµР· РЅРµС‘ РЅР°Р·РЅР°С‡РµРЅРёРµ СЂРѕР»РµР№ РІ Р°РґРјРёРЅРєРµ РІСЃС‘ СЂР°РІРЅРѕ СЂР°Р±РѕС‚Р°РµС‚ (profiles.role).

CREATE TABLE IF NOT EXISTS public.role_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_audit_created_at_idx ON public.role_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS role_audit_target_id_idx ON public.role_audit (target_id);

