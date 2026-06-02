-- Р’С‹РїРѕР»РЅРёС‚СЊ РІ Supabase РїСЂРѕРµРєС‚Рµ SPOTIFY STORE (РЅРµ GPT), РµСЃР»Рё РѕС‚Р·С‹РІС‹ РёР· РєР°Р±РёРЅРµС‚Р° РЅРµ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ.
-- РўР°Р±Р»РёС†Р° РґР»СЏ РјРѕРґРµСЂР°С†РёРё: pending в†’ approved/rejected + is_published.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  profile_id uuid references auth.users (id) on delete set null,
  name text,
  text text not null default '',
  rating int check (rating >= 1 and rating <= 5),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_status_idx on public.reviews (status);
create index if not exists reviews_is_published_idx on public.reviews (is_published);

alter table public.reviews enable row level security;

-- РџСѓР±Р»РёС‡РЅРѕ С‚РѕР»СЊРєРѕ РѕРїСѓР±Р»РёРєРѕРІР°РЅРЅС‹Рµ (Р»РµРЅРґРёРЅРі)
drop policy if exists "reviews_select_published" on public.reviews;
create policy "reviews_select_published" on public.reviews
  for select using (is_published = true and status = 'approved');

