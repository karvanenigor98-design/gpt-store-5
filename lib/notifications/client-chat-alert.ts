/**
 * Уведомление staff при сообщении клиента в чат поддержки.
 * В БД — всегда; email — с троттлингом (не чаще 1 раз / 60 с на сессию).
 */

import { canSendChatEmailNotification } from "@/lib/chat/email-notification-throttle";
import { emailStaffClientChatMessage } from "@/lib/email/notify-hooks";
import {
  recordGptStaffNotification,
  recordSubsStaffNotification,
} from "@/lib/notifications/staff-events";
import { sendTelegramStaffChatAlert } from "@/lib/telegram/notifications";

export async function alertStaffOnClientSupportMessage(params: {
  siteSlug: "gpt-store" | "subs-store";
  sessionId: string;
  clientUserId: string | null;
  clientEmail: string | null;
  messagePreview: string;
  clientName?: string | null;
  telegramUsername?: string | null;
}): Promise<void> {
  const preview = (params.messagePreview || "—").slice(0, 400);
  const email = params.clientEmail?.trim() || null;
  const name = params.clientName?.trim() || null;
  const tg = params.telegramUsername?.replace(/^@+/, "").trim() || null;
  const who =
    [name, email, tg ? `@${tg}` : null].filter(Boolean).join(" · ") ||
    params.clientUserId ||
    "гость";
  const storeLabel = params.siteSlug === "subs-store" ? "SPOTIFY STORE" : "GPT STORE";
  const app = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3056";

  const chatHref =
    params.siteSlug === "subs-store"
      ? `${app}/operator/chat?site=subs-store&thread_id=${params.sessionId}`
      : `${app}/operator/chat?site=gpt-store&session_id=${params.sessionId}`;

  const title = `${storeLabel}: новое сообщение`;
  const message = `${who}: «${preview}»`;

  if (params.siteSlug === "subs-store") {
    await recordSubsStaffNotification({
      type: "new_chat_message",
      title,
      message,
      entity_type: "chat_thread",
      entity_id: params.sessionId,
      sendEmail: false,
      refreshExistingChat: true,
    });
  } else {
    await recordGptStaffNotification({
      type: "new_chat_message",
      title,
      message,
      entity_type: "chat_session",
      entity_id: params.sessionId,
      siteSlug: "gpt-store",
      refreshExistingChat: true,
    });
  }

  // Telegram is independent of email throttle — always notify staff chat.
  void sendTelegramStaffChatAlert({
    clientEmail: email,
    messagePreview: preview,
    chatHref,
    siteSlug: params.siteSlug,
  }).catch(() => undefined);

  if (!canSendChatEmailNotification(`staff:${params.siteSlug}:${params.sessionId}`)) {
    return;
  }

  await emailStaffClientChatMessage({
    siteSlug: params.siteSlug,
    sessionId: params.sessionId,
    clientEmail: email,
    messagePreview: preview,
  });
}
