-- =============================================================================
-- МИГРАЦИЯ В 4 ШАГА для Supabase SQL Editor
--
-- КАК ЗАПУСКАТЬ
--   Вариант A (проще): открой этот файл → Ctrl+A → вставь в SQL Editor → Run ОДИН раз.
--   Вариант B: по очереди выделяй только текст МЕЖДУ маркерами
--        «ШАГ 1» (весь блок DO до $step1ix$;)
--        → Run, затем «ШАГ 2 НАЧАЛО» … «ШАГ 2 КОНЕЦ» → Run, и т.д.
--   Повторный полный запуск может дать «policy already exists» — тогда не перезапускай всё.
--
-- Триггер: если ошибка про execute procedure — в ШАГе 2 замени на execute function (уже так в этом файле).
-- =============================================================================


-- ############################################################################
-- ## ШАГ 1 — только «долечка» старых таблиц (orders / chat)
-- ## Выполни ПЕРВЫМ. Безопасно повторять. На совсем пустой БД просто ничего не сделает.
-- ############################################################################

DO $step1$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text';
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_provider text';
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_id text';
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pally_order_id text';
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS account_email text';
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS token_received_at timestamptz';
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS activated_at timestamptz';
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS expires_at timestamptz';
    EXECUTE 'ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS meta jsonb';
  END IF;

  IF to_regclass('public.chat_sessions') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS first_message_at timestamptz';
    EXECUTE 'ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS last_operator_reply_at timestamptz';
    EXECUTE 'ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()';
  END IF;

  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    -- session_id с FK только если chat_sessions уже есть (иначе «relation chat_sessions does not exist»)
    IF to_regclass('public.chat_sessions') IS NOT NULL THEN
      EXECUTE 'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE';
    ELSE
      EXECUTE 'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS session_id uuid';
    END IF;
    EXECUTE 'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_id uuid';
    EXECUTE 'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_type text';
    EXECUTE 'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS content text';
    EXECUTE 'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachments jsonb';
    EXECUTE 'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false';
    EXECUTE 'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_auto_reply boolean NOT NULL DEFAULT false';
    EXECUTE 'ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()';
  END IF;
END
$step1$;

DO $step1ix$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS orders_pally_order_id_idx ON public.orders(pally_order_id)';
  END IF;
  IF to_regclass('public.chat_messages') IS NOT NULL
     AND to_regclass('public.chat_sessions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON public.chat_messages(session_id)';
  END IF;
END
$step1ix$;


-- ############################################################################
-- ## ШАГ 2 — схема 001 (таблицы, триггер, индексы, RLS, политики до чата включительно)
-- ## Вставь ВЕСЬ блок от «ШАГ 2 НАЧАЛО» до «ШАГ 2 КОНЕЦ» и нажми Run ОДИН раз.
-- ## Если ошибка «policy ... already exists» — значит шаг уже делали; переходи к ШАГу 3.
-- ############################################################################

-- ======================== ШАГ 2 НАЧАЛО ========================

create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text,
  username      text,
  telegram_id   bigint unique,
  telegram_username text,
  role          text not null default 'client' check (role in ('client', 'operator', 'admin')),
  created_at    timestamptz not null default now(),
  last_seen     timestamptz,
  notes         text,
  tags          text[]
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references public.profiles on delete set null,
  product           text not null,
  plan_id           text not null,
  price             integer not null,
  currency          text not null default 'RUB',
  payment_method    text,
  payment_provider  text,
  payment_id        text,
  pally_order_id    text,
  status            text not null default 'pending'
    check (status in ('pending','paid','activating','waiting_client','active','failed','refunded','expired')),
  account_email     text,
  token_received_at timestamptz,
  activated_at      timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  meta              jsonb
);

alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_id text;
alter table public.orders add column if not exists pally_order_id text;
alter table public.orders add column if not exists account_email text;
alter table public.orders add column if not exists token_received_at timestamptz;
alter table public.orders add column if not exists activated_at timestamptz;
alter table public.orders add column if not exists expires_at timestamptz;
alter table public.orders add column if not exists meta jsonb;

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_pally_order_id_idx on public.orders(pally_order_id);

create table if not exists public.chat_sessions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid references public.profiles on delete set null,
  type                    text not null default 'operator' check (type in ('operator', 'ai')),
  status                  text not null default 'open' check (status in ('open', 'closed')),
  first_message_at        timestamptz,
  last_operator_reply_at  timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.chat_sessions add column if not exists first_message_at timestamptz;
alter table public.chat_sessions add column if not exists last_operator_reply_at timestamptz;
alter table public.chat_sessions add column if not exists updated_at timestamptz not null default now();

create index if not exists chat_sessions_user_id_idx on public.chat_sessions(user_id);
create index if not exists chat_sessions_status_idx on public.chat_sessions(status);

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.chat_sessions on delete cascade,
  sender_id    uuid,
  sender_type  text not null check (sender_type in ('client', 'operator', 'ai', 'auto')),
  content      text not null,
  attachments  jsonb,
  is_read      boolean not null default false,
  is_auto_reply boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.chat_messages add column if not exists session_id uuid references public.chat_sessions(id) on delete cascade;
alter table public.chat_messages add column if not exists sender_id uuid;
alter table public.chat_messages add column if not exists sender_type text;
alter table public.chat_messages add column if not exists content text;
alter table public.chat_messages add column if not exists attachments jsonb;
alter table public.chat_messages add column if not exists is_read boolean not null default false;
alter table public.chat_messages add column if not exists is_auto_reply boolean not null default false;
alter table public.chat_messages add column if not exists created_at timestamptz not null default now();

create index if not exists chat_messages_session_id_idx on public.chat_messages(session_id);

create table if not exists public.reviews (
  id                  uuid primary key default gen_random_uuid(),
  telegram_message_id bigint unique,
  telegram_chat_id    bigint,
  author_name         text,
  author_username     text,
  author_avatar_url   text,
  content             text not null,
  media_urls          jsonb,
  original_url        text,
  telegram_date       timestamptz,
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists reviews_status_idx on public.reviews(status);

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value) values
  ('auto_reply_delay_minutes', '15'),
  ('operator_telegram_url', '"https://t.me/subrfmanager"'),
  ('night_start_hour', '22'),
  ('night_end_hour', '9')
on conflict (key) do nothing;

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.reviews enable row level security;
alter table public.site_settings enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_select_admin" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id);

create policy "orders_select_admin" on public.orders
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "orders_insert_own" on public.orders
  for insert with check (auth.uid() = user_id);

create policy "orders_update_admin" on public.orders
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "sessions_select_own" on public.chat_sessions
  for select using (auth.uid() = user_id);

create policy "sessions_select_admin" on public.chat_sessions
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "sessions_insert_own" on public.chat_sessions
  for insert with check (auth.uid() = user_id);

create policy "messages_select" on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id
        and (s.user_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator')))
    )
  );

create policy "messages_insert" on public.chat_messages
  for insert with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = session_id
        and (s.user_id = auth.uid()
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator')))
    )
  );

create policy "reviews_select_approved" on public.reviews
  for select using (status = 'approved');

create policy "reviews_select_admin" on public.reviews
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "reviews_update_admin" on public.reviews
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'operator'))
  );

create policy "settings_select_all" on public.site_settings
  for select using (true);

create policy "settings_update_admin" on public.site_settings
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ======================== ШАГ 2 КОНЕЦ ========================


-- ############################################################################
-- ## ШАГ 3 — расширение чата 002 + промокоды 003
-- ## Вставь весь блок от «ШАГ 3 НАЧАЛО» до «ШАГ 3 КОНЕЦ» и Run.
-- ############################################################################

-- ======================== ШАГ 3 НАЧАЛО ========================

ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_type_check;
ALTER TABLE public.chat_messages ADD CONSTRAINT chat_messages_sender_type_check
  CHECK (sender_type IN ('client', 'operator', 'admin', 'ai', 'auto'));

ALTER TABLE public.chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_type_check;
ALTER TABLE public.chat_sessions ADD CONSTRAINT chat_sessions_type_check
  CHECK (type IN ('operator', 'ai', 'staff'));

ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS staff_peer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS chat_sessions_staff_peer_idx ON public.chat_sessions(staff_peer_id);

DROP POLICY IF EXISTS "sessions_select_staff_participant" ON public.chat_sessions;
CREATE POLICY "sessions_select_staff_participant" ON public.chat_sessions
  FOR SELECT USING (
    type = 'staff'
    AND (auth.uid() = user_id OR auth.uid() = staff_peer_id)
  );

DROP POLICY IF EXISTS "messages_select" ON public.chat_messages;
CREATE POLICY "messages_select" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id
        AND (
          (s.type = 'staff' AND (auth.uid() = s.user_id OR auth.uid() = s.staff_peer_id))
          OR (
            s.type IN ('operator', 'ai')
            AND (
              s.user_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.role IN ('admin', 'operator')
              )
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "messages_insert" ON public.chat_messages;
CREATE POLICY "messages_insert" ON public.chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      WHERE s.id = session_id
        AND (
          (s.type = 'staff' AND (auth.uid() = s.user_id OR auth.uid() = s.staff_peer_id))
          OR (
            s.type IN ('operator', 'ai')
            AND (
              s.user_id = auth.uid()
              OR EXISTS (
                SELECT 1 FROM public.profiles p
                WHERE p.id = auth.uid() AND p.role IN ('admin', 'operator')
              )
            )
          )
        )
    )
  );

CREATE TABLE IF NOT EXISTS public.promocodes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  discount_type   text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  integer NOT NULL CHECK (discount_value >= 0),
  plan_ids        text[] DEFAULT NULL,
  max_uses        integer,
  uses_count      integer NOT NULL DEFAULT 0,
  valid_from      timestamptz,
  valid_until     timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promocodes_code_active_idx ON public.promocodes (code) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.landing_discounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  discount_type   text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value  integer NOT NULL CHECK (discount_value >= 0),
  applies_to      text NOT NULL DEFAULT 'all',
  valid_from      timestamptz,
  valid_until     timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS landing_discounts_active_idx ON public.landing_discounts (is_active);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS client_stage text;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reviews_profile_id_idx ON public.reviews(profile_id);

ALTER TABLE public.promocodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promocodes_select_admin" ON public.promocodes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "promocodes_write_admin" ON public.promocodes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "landing_discounts_select_admin" ON public.landing_discounts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "landing_discounts_write_admin" ON public.landing_discounts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ======================== ШАГ 3 КОНЕЦ ========================


-- ############################################################################
-- ## ШАГ 4 — мультисайт (009): sites, site_id, site_memberships
-- ## Вставь весь блок от «ШАГ 4 НАЧАЛО» до «ШАГ 4 КОНЕЦ» и Run.
-- ## Email супер-админа: nbuzanov0@mail.ru — при необходимости замени на свой в двух INSERT внизу.
-- ############################################################################

-- ======================== ШАГ 4 НАЧАЛО ========================

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

INSERT INTO public.sites (slug, brand_name, product_type, support_telegram, support_email, primary_color, accent_color, seo_title)
VALUES
  ('gpt-store',  'GPT STORE',  'chatgpt', '@subrfmanager', 'nbuzanov0@mail.ru', '#10a37f', '#10a37f', 'GPT STORE - ChatGPT Plus bez inostrannoj karty'),
  ('subs-store', 'Subs Store', 'spotify',  '@subs_support', 'nbuzanov0@mail.ru', '#1DB954', '#1DB954', 'Subs Store - Spotify Premium v Rossii')
ON CONFLICT (slug) DO UPDATE
  SET brand_name       = EXCLUDED.brand_name,
      product_type     = EXCLUDED.product_type,
      support_telegram = EXCLUDED.support_telegram,
      support_email    = EXCLUDED.support_email,
      primary_color    = EXCLUDED.primary_color,
      accent_color     = EXCLUDED.accent_color,
      seo_title        = EXCLUDED.seo_title,
      updated_at       = now();

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

-- Старая таблица orders без product/plan_id — шаг 4 использует product для subs vs gpt
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS product text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS plan_id text;
UPDATE public.orders SET product = 'chatgpt' WHERE product IS NULL;
UPDATE public.orders SET plan_id = COALESCE(plan_id, 'default') WHERE plan_id IS NULL;

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

-- ======================== ШАГ 4 КОНЕЦ ========================

-- Проверка (отдельным Run):
-- select slug, id from public.sites order by slug;
-- select site_slug, count(*) from public.site_memberships group by site_slug;
