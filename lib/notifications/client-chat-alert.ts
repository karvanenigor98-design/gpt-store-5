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
}): Promise<void> {
  const preview = (params.messagePreview || "—").slice(0, 400);
  const who = params.clientEmail?.trim() || params.clientUserId || "гость";
  const app = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3056";

  const chatHref =
    params.siteSlug === "subs-store"
      ? `${app}/operator/chat?site=subs-store&thread_id=${params.sessionId}`
      : `${app}/operator/chat?site=gpt-store&session_id=${params.sessionId}`;

  if (params.siteSlug === "subs-store") {
    await recordSubsStaffNotification({
      type: "new_chat_message",
      title: "Subs Store: клиент написал",
      message: `${who}: ${preview}`,
      entity_type: "chat_thread",
      entity_id: params.sessionId,
      sendEmail: false,
    });
  } else {
    await recordGptStaffNotification({
      type: "new_chat_message",
      title: "💬 Клиент написал",
      message: `${who}: ${preview}`,
      entity_type: "chat_session",
      entity_id: params.sessionId,
      siteSlug: "gpt-store",
    });
  }

  if (!canSendChatEmailNotification(`staff:${params.siteSlug}:${params.sessionId}`)) {
    return;
  }

  await emailStaffClientChatMessage({
    siteSlug: params.siteSlug,
    sessionId: params.sessionId,
    clientEmail: params.clientEmail,
    messagePreview: preview,
  });

  if (params.siteSlug === "gpt-store") {
    await sendTelegramStaffChatAlert({
      clientEmail: params.clientEmail,
      messagePreview: preview,
      chatHref,
    });
  }
}
