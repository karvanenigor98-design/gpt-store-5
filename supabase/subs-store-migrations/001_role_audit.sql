-- Subs Store (отдельный Supabase-проект «spotify»)
-- Выполнить в SQL Editor этого проекта, если таблицы role_audit ещё нет.
-- Без неё назначение ролей в админке всё равно работает (profiles.role).

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
