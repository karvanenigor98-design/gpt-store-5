import { resolveRoleByEmail } from "@/lib/auth/resolveRole";
import { isSuperAdminEmail, normalizeAuthEmail } from "@/lib/auth/superAdmin";
import type { UserRole } from "@/types/database";

/** Админы GPT STORE — роль без env/Edge (ADMIN_EMAILS на Edge часто пустой). */
export const KNOWN_ADMIN_EMAILS = ["nbuzanov0@mail.ru", "nbuzanov@mail.ru"] as const;

/** Основной оператор GPT STORE — роль без lookup profiles. */
export const KNOWN_OPERATOR_EMAILS = ["a.havronicheff@yandex.ru", "andreihavronicheff@yandex.ru"] as const;

function isKnownAdminEmail(email: string | null | undefined): boolean {
  const n = normalizeAuthEmail(email);
  return KNOWN_ADMIN_EMAILS.some((item) => item === n);
}

function isKnownOperatorEmail(email: string | null | undefined): boolean {
  const n = normalizeAuthEmail(email);
  return KNOWN_OPERATOR_EMAILS.some((item) => item === n);
}

/** Роль staff без БД: hardcoded + env + супер-админ. */
export function fastStaffRoleFromEmail(email: string | null | undefined): "admin" | "operator" | null {
  if (isSuperAdminEmail(email) || isKnownAdminEmail(email)) return "admin";
  if (isKnownOperatorEmail(email)) return "operator";
  const fromEnv = resolveRoleByEmail(email);
  if (fromEnv === "admin" || fromEnv === "operator") return fromEnv;
  return null;
}

export function roleFromEmailFallback(email: string | null | undefined): UserRole {
  return fastStaffRoleFromEmail(email) ?? "client";
}
