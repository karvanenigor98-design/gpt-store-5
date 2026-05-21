-- Subs Store (проект Spotify): колонка Telegram в profiles
-- Idempotent — безопасно запускать повторно.
-- Dashboard → SQL Editor → New query → Run

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_username text;

COMMENT ON COLUMN public.profiles.telegram_username IS
  'Telegram @username без символа @';
