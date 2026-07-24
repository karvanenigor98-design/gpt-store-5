import type { SiteSlug } from "@/lib/sites";

function splitIds(...raw: Array<string | undefined>): string[] {
  return Array.from(
    new Set(
      raw
        .flatMap((value) => (value ?? "").split(","))
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  );
}

/** Bot token for site. Subs falls back to GPT token only if dedicated env missing. */
export function resolveTelegramBotToken(siteSlug: SiteSlug = "gpt-store"): string {
  if (siteSlug === "subs-store") {
    return (
      process.env.TELEGRAM_SUBS_BOT_TOKEN?.trim() ||
      process.env.TELEGRAM_BOT_TOKEN?.trim() ||
      ""
    );
  }
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
}

/** Admin/operator chat ids for site. */
export function resolveTelegramChatIds(siteSlug: SiteSlug = "gpt-store"): string[] {
  if (siteSlug === "subs-store") {
    const subs = splitIds(
      process.env.TELEGRAM_SUBS_ADMIN_CHAT_ID,
      process.env.TELEGRAM_SUBS_ADMIN_CHAT_IDS,
      process.env.TELEGRAM_SUBS_OPERATOR_CHAT_ID,
      process.env.TELEGRAM_SUBS_OPERATOR_CHAT_IDS,
    );
    if (subs.length) return subs;
  }

  return splitIds(
    process.env.TELEGRAM_ADMIN_CHAT_ID,
    process.env.TELEGRAM_ADMIN_CHAT_IDS,
    process.env.TELEGRAM_OPERATOR_CHAT_ID,
    process.env.TELEGRAM_OPERATOR_CHAT_IDS,
  );
}

export function resolveTelegramBotUsername(siteSlug: SiteSlug = "gpt-store"): string {
  if (siteSlug === "subs-store") {
    return (
      process.env.TELEGRAM_SUBS_BOT_USERNAME?.trim() ||
      process.env.TELEGRAM_BOT_USERNAME?.trim() ||
      ""
    );
  }
  return process.env.TELEGRAM_BOT_USERNAME?.trim() || "";
}
