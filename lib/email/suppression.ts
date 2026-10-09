/**
 * Optional suppression for system/transactional notification emails only.
 *
 * - Auth emails (signup / reset / magic link) bypass this via purpose="auth".
 * - In-app notifications and Telegram are unaffected.
 * - Addresses: EMAIL_NOTIFICATION_BLOCKLIST (comma-separated). Empty = send to everyone.
 */
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
  return envBlocklist().includes(normalized);
}

/** For diagnostics / admin UI — never log secrets. */
export function listConfiguredEmailSuppressions(): {
  requiredCount: number;
  envBlocklistCount: number;
} {
  return {
    requiredCount: 0,
    envBlocklistCount: envBlocklist().length,
  };
}
