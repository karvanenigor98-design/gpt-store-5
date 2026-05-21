import type { UserRole } from "@/types/database";

/** Основной email супер-админа (используется в UI и документации). */
export const SUPER_ADMIN_EMAIL = "nbuzanov0@mail.ru" as const;

/** Дубликаты/старые записи в Supabase Auth — те же права admin. */
export const SUPER_ADMIN_EMAIL_ALIASES = [
  SUPER_ADMIN_EMAIL,
  "nbuzanov@mail.ru",
] as const;

export function normalizeAuthEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeAuthEmail(email);
  return SUPER_ADMIN_EMAIL_ALIASES.some((e) => normalizeAuthEmail(e) === normalized);
}

/** Эффективная роль для доступа: БД + исключение супер-админа. */
export function effectiveRoleFromProfile(
  profileRole: UserRole | null | undefined,
  email: string | null | undefined
): UserRole {
  if (isSuperAdminEmail(email)) return "admin";
  if (profileRole === "admin" || profileRole === "operator" || profileRole === "client") {
    return profileRole;
  }
  return "client";
}
