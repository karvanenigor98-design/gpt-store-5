import { resolveRoleByEmail } from "@/lib/auth/resolveRole";
import { isSuperAdminEmail, normalizeAuthEmail } from "@/lib/auth/superAdmin";
import type { UserRole } from "@/types/database";

/** Основной оператор GPT STORE — роль без lookup profiles. */
export const KNOWN_OPERATOR_EMAILS = ["a.havronicheff@yandex.ru", "andreihavronicheff@yandex.ru"] as const;

function isKnownOperatorEmail(email: string | null | undefined): boolean {
  const n = normalizeAuthEmail(email);
  return KNOWN_OPERATOR_EMAILS.some((item) => item === n);
}

/** Роль staff без БД: env + супер-админ + известный оператор. */
export function fastStaffRoleFromEmail(email: string | null | undefined): "admin" | "operator" | null {
  if (isSuperAdminEmail(email)) return "admin";
  if (isKnownOperatorEmail(email)) return "operator";
  const fromEnv = resolveRoleByEmail(email);
  if (fromEnv === "admin" || fromEnv === "operator") return fromEnv;
  return null;
}

export function roleFromEmailFallback(email: string | null | undefined): UserRole {
  return fastStaffRoleFromEmail(email) ?? "client";
}
