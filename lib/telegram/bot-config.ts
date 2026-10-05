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
const DEAD_TELEGRAM_CHAT_IDS = new Set(["-528847007", "0"]);

export function resolveTelegramChatIds(siteSlug: SiteSlug = "gpt-store"): string[] {
  const raw =
    siteSlug === "subs-store"
      ? splitIds(
          process.env.TELEGRAM_SUBS_ADMIN_CHAT_ID,
          process.env.TELEGRAM_SUBS_ADMIN_CHAT_IDS,
          process.env.TELEGRAM_SUBS_OPERATOR_CHAT_ID,
          process.env.TELEGRAM_SUBS_OPERATOR_CHAT_IDS,
        )
      : [];

  const ids = (raw.length ? raw : splitIds(
    process.env.TELEGRAM_ADMIN_CHAT_ID,
    process.env.TELEGRAM_ADMIN_CHAT_IDS,
    process.env.TELEGRAM_OPERATOR_CHAT_ID,
    process.env.TELEGRAM_OPERATOR_CHAT_IDS,
  )).filter((id) => !DEAD_TELEGRAM_CHAT_IDS.has(id));

  return ids;
}

/** Forum topic id for staff group. Omit if the chat is not a forum. */
export function resolveTelegramMessageThreadId(siteSlug: SiteSlug = "gpt-store"): number | null {
  const raw =
    siteSlug === "subs-store"
      ? process.env.TELEGRAM_SUBS_ADMIN_MESSAGE_THREAD_ID?.trim() ||
        process.env.TELEGRAM_ADMIN_MESSAGE_THREAD_ID?.trim()
      : process.env.TELEGRAM_ADMIN_MESSAGE_THREAD_ID?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
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
