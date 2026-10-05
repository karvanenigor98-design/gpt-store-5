/** Telegram Bot API egress. */

export function canDeliverTelegramHere(): boolean {
  if (process.env.TELEGRAM_BLOCK_SEND === "1") return false;
  if (process.env.TELEGRAM_ALLOW_LOCAL_SEND === "1") return true;
  if (process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV)) return true;
  // gptplus-store.ru (VPS) reaches api.telegram.org. Do not defer to a dead *.vercel.app kick.
  if (process.env.NODE_ENV === "production") return true;
  return false;
}

export function resolveTelegramDrainBaseUrl(): string {
  const explicit = process.env.TELEGRAM_OUTBOX_DRAIN_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return "https://gptplus-store.ru";
}
