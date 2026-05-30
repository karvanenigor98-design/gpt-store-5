-- Безопасно: опциональная метка времени оплаты (GPT + subs projects — применить в обе БД при необходимости).
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders (paid_at) WHERE paid_at IS NOT NULL;
