/**
 * Suppression for system/transactional notification emails only.
 *
 * - Auth emails (signup / reset / magic link) bypass this via purpose="auth".
 * - In-app notifications and Telegram are unaffected.
 * - Extra addresses: EMAIL_NOTIFICATION_BLOCKLIST (comma-separated).
 */
const REQUIRED_SUPPRESSED_RECIPIENTS = new Set([
  "karvanenigor98@gmail.com",
  "nbuzanov@mail.ru",
]);

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function envBlocklist(): string[] {
  return (process.env.EMAIL_NOTIFICATION_BLOCKLIST ?? "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean);
}

export function isEmailRecipientSuppressed(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (REQUIRED_SUPPRESSED_RECIPIENTS.has(normalized)) return true;
  return envBlocklist().includes(normalized);
}

/** For diagnostics / admin UI — never log secrets. */
export function listConfiguredEmailSuppressions(): {
  requiredCount: number;
  envBlocklistCount: number;
} {
  return {
    requiredCount: REQUIRED_SUPPRESSED_RECIPIENTS.size,
    envBlocklistCount: envBlocklist().length,
  };
}
