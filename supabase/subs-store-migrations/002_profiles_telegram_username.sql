-- Spotify Store (РїСЂРѕРµРєС‚ Spotify): РєРѕР»РѕРЅРєР° Telegram РІ profiles
-- Idempotent вЂ” Р±РµР·РѕРїР°СЃРЅРѕ Р·Р°РїСѓСЃРєР°С‚СЊ РїРѕРІС‚РѕСЂРЅРѕ.
-- Dashboard в†’ SQL Editor в†’ New query в†’ Run

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_username text;

COMMENT ON COLUMN public.profiles.telegram_username IS
  'Telegram @username Р±РµР· СЃРёРјРІРѕР»Р° @';

