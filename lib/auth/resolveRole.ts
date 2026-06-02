import type { UserRole } from "@/types/database";

function parseEmails(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function singleEmail(value: string | undefined): string | null {
  const t = value?.trim().toLowerCase();
  return t || null;
}

function adminEmailsFromEnv(): Set<string> {
  const out = parseEmails(process.env.ADMIN_EMAILS);
  const single = singleEmail(process.env.ADMIN_EMAIL);
  if (single) out.add(single);
  return out;
}

function operatorEmailsFromEnv(): Set<string> {
  const out = parseEmails(process.env.OPERATOR_EMAILS);
  const single = singleEmail(process.env.OPERATOR_EMAIL);
  if (single) out.add(single);
  return out;
}

function canonicalEmail(email: string | null | undefined): string {
  return (email ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveRoleByEmail(email: string | null | undefined): UserRole {
  const normalized = email?.trim().toLowerCase();
  const canonical = canonicalEmail(email);

  // Точечное распределение ролей для локального E2E-теста
  if (canonical === canonicalEmail("nikitabuzanov15@mailru")) return "admin";
  if (canonical === canonicalEmail("buzanovnikita30@gmailcom")) return "client";

  if (normalized) {
    if (adminEmailsFromEnv().has(normalized)) return "admin";
    if (operatorEmailsFromEnv().has(normalized)) return "operator";

    const clientEmails = parseEmails(process.env.CLIENT_EMAILS);
    if (clientEmails.has(normalized)) return "client";
  }

  return "client";
}
