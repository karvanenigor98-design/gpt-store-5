/**
 * Запись в notifications + email всем admin/operator (GPT и Subs Store).
 */

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { dispatchStaffSiteEmails } from "@/lib/email/dispatch";
import type { EmailEventType } from "@/lib/email/events";
import { buildStaffOrderUrl, resolveAppBaseUrl } from "@/lib/email/site-urls";
import type { NotificationType } from "@/types/database";

import {
  insertSubsStoreNotification,
  resolveSubsInboxRecipientUserId,
} from "@/lib/subs/subs-notifications";

function mapTypeToEmailEvent(type: NotificationType): EmailEventType {
  if (type === "new_order") return "staff_new_order";
  if (type === "new_chat_message") return "chat_client_message";
  if (type === "new_review") return "new_review";
  if (type === "payment_success") return "order_paid";
  if (type === "payment_failed") return "payment_failed";
  return "order_problem";
}

async function sendStaffEmailForEvent(params: {
  siteSlug: "gpt-store" | "subs-store";
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
}): Promise<void> {
  const orderId = params.entity_type === "order" ? params.entity_id ?? undefined : undefined;
  const chatId =
    params.entity_type === "chat_session" || params.entity_type === "chat_thread"
      ? params.entity_id ?? undefined
      : undefined;

  await dispatchStaffSiteEmails({
    siteSlug: params.siteSlug,
    eventType: mapTypeToEmailEvent(params.type),
    title: params.title.replace(/^[^\wа-яА-Я]+/u, "").trim() || params.title,
    bodyLines: [params.message],
    ctaLabel: chatId ? "Открыть чат" : orderId ? "Открыть заказ" : "Админка",
    ctaUrl: chatId
      ? `${resolveAppBaseUrl()}/operator/chat?site=${params.siteSlug}${params.siteSlug === "subs-store" ? `&thread_id=${chatId}` : `&session_id=${chatId}`}`
      : buildStaffOrderUrl(params.siteSlug, orderId),
    dedupeKey: `staff:${params.type}:${params.siteSlug}:${params.entity_id ?? params.title}`,
    relatedEntityType: params.entity_type ?? null,
    relatedEntityId: params.entity_id ?? null,
  });
}

/** Строка в GPT Supabase notifications (админка ?site=gpt-store). */
export async function recordGptStaffNotification(params: {
  type: NotificationType;
  title: string;
  message: string;
  siteSlug?: "gpt-store" | "subs-store";
  entity_type?: string | null;
  entity_id?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const siteSlug = params.siteSlug ?? "gpt-store";
    const siteId = await getSiteUUID(siteSlug);

    const { error } = await admin.from("notifications").insert({
      site_id: siteId,
      recipient_user_id: null,
      recipient_role: null,
      type: params.type,
      title: params.title.trim().slice(0, 500),
      message: params.message.trim().slice(0, 2000),
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      is_read: false,
    });
    if (error) {
      console.error("[staff-events] GPT notification insert:", error.message);
    }
  } catch (err) {
    console.error("[staff-events] GPT notification insert:", err);
  }
}

/** Inbox Subs + email staff. */
export async function recordSubsStaffNotification(params: {
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
  emailSubject?: string;
  emailBody?: string;
  /** false — только строка в Subs notifications (email уже отправлен). */
  sendEmail?: boolean;
}): Promise<void> {
  const subs = createSubsStoreAdminClient();
  if (!subs) return;

  const inboxId = await resolveSubsInboxRecipientUserId(subs);
  if (inboxId) {
    await insertSubsStoreNotification({
      recipientUserId: inboxId,
      type: params.type,
      title: params.title,
      message: params.message,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
    });
  } else {
    console.warn(
      "[staff-events] Subs: нет inbox user — уведомление в БД пропущено, email staff всё равно отправим. npm run env:subs-inbox",
    );
  }

  if (params.sendEmail !== false) {
    await sendStaffEmailForEvent({
      siteSlug: "subs-store",
      type: params.type,
      title: params.emailSubject ?? params.title,
      message: params.emailBody ?? params.message,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
    });
  }
}

/** DB + email для GPT Store. */
export async function recordGptStaffEvent(params: {
  type: NotificationType;
  title: string;
  message: string;
  siteSlug?: "gpt-store" | "subs-store";
  entity_type?: string | null;
  entity_id?: string | null;
  emailSubject: string;
  emailBody: string;
}): Promise<void> {
  await recordGptStaffNotification({
    type: params.type,
    title: params.title,
    message: params.message,
    siteSlug: params.siteSlug,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
  });

  const site = params.siteSlug ?? "gpt-store";
  await sendStaffEmailForEvent({
    siteSlug: site,
    type: params.type,
    title: params.emailSubject,
    message: params.emailBody,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
  });

  if (site === "subs-store") {
    await recordSubsStaffNotification({
      type: params.type,
      title: params.title,
      message: params.message,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      emailSubject: params.emailSubject,
      emailBody: params.emailBody,
      sendEmail: false,
    });
  }
}
