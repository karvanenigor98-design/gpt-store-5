/**
 * Mirror staff email alerts into Telegram admin/operator chats.
 * Delivery goes through notification_outbox (Vercel drain).
 */

import type { SiteSlug } from "@/lib/sites";
import { broadcastTelegramToStaff } from "@/lib/telegram/notifications";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function mirrorStaffEmailToTelegram(params: {
  siteSlug: SiteSlug;
  eventType: string;
  title: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  dedupeKey?: string;
}): Promise<void> {
  // Chat client messages already go via sendTelegramStaffChatAlert (not throttled with email).
  if (params.eventType === "chat_client_message") return;

  const brand = params.siteSlug === "subs-store" ? "SPOTIFY STORE" : "GPT STORE";
  const lines = params.bodyLines
    .flatMap((line) => line.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);
  const text = [
    `🔔 <b>${escapeHtml(params.title.trim() || "Уведомление")}</b>`,
    `🏪 ${brand}`,
    ...lines.map((line) => escapeHtml(line)),
    params.ctaUrl
      ? `🔗 <a href="${escapeHtml(params.ctaUrl)}">${escapeHtml(params.ctaLabel?.trim() || "Открыть")}</a>`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  await broadcastTelegramToStaff(text, {
    siteSlug: params.siteSlug,
    eventType: `staff_email:${params.eventType}`,
    dedupeKey: params.dedupeKey
      ? `staff_email:${params.dedupeKey}`
      : `staff_email:${params.eventType}:${params.siteSlug}:${params.title.slice(0, 64)}`,
  });
}
