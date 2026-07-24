/** Telegram Bot API egress: only Vercel (or explicit allow) can reach api.telegram.org. */

export function canDeliverTelegramHere(): boolean {
  if (process.env.TELEGRAM_ALLOW_LOCAL_SEND === "1") return true;
  if (process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV)) return true;
  return false;
}

export function resolveTelegramDrainBaseUrl(): string {
  const explicit = process.env.TELEGRAM_OUTBOX_DRAIN_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  // Prefer *.vercel.app — custom domains may point at VPS without Telegram egress.
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.NEXT_PUBLIC_LEGACY_SITE_URL?.trim() ||
    "https://gpt-store-5.vercel.app";
  try {
    const url = new URL(
      /^https?:\/\//i.test(vercelHost) ? vercelHost : `https://${vercelHost}`,
    );
    return url.origin;
  } catch {
    return "https://gpt-store-5.vercel.app";
  }
}
