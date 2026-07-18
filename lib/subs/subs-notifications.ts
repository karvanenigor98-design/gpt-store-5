/**
 * Server-only: insert rows into Subs Store Supabase `public.notifications`.
 * `recipient_user_id` must exist in that project's auth.users (FK).
 *
 * Для «операторских» уведомлений (новое сообщение клиента) используйте
 * SUBS_NOTIFICATIONS_INBOX_USER_ID — UUID пользователя в Subs Auth (сервисный аккаунт),
 * либо создайте в Subs Auth пользователя с тем же email, что и ADMIN_EMAIL / первый из ADMIN_EMAILS.
 */

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { subsOrderStatusLabelRu } from "@/lib/admin/subs-order-status-labels";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Json } from "@/types/database";
import type { NotificationType } from "@/types/database";

export type SubsNotificationInsertType = NotificationType;

function clipMessage(text: string, max = 1800): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function staffInboxEmailsFromEnv(): string[] {
  const out: string[] = [];
  const direct = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (direct) out.push(direct);
  const operatorDirect = process.env.OPERATOR_EMAIL?.trim().toLowerCase();
  if (operatorDirect) out.push(operatorDirect);
  for (const raw of [process.env.ADMIN_EMAILS, process.env.OPERATOR_EMAILS]) {
    if (!raw?.trim()) continue;
    for (const e of raw.split(",")) {
      const n = e.trim().toLowerCase();
      if (n) out.push(n);
    }
  }
  return [...new Set(out)];
}

export async function resolveSubsInboxRecipientUserId(
  subs: NonNullable<ReturnType<typeof createSubsStoreAdminClient>>,
): Promise<string | null> {
  const configured = process.env.SUBS_NOTIFICATIONS_INBOX_USER_ID?.trim();
  if (configured) {
    const { data, error } = await subs.auth.admin.getUserById(configured);
    if (!error && data.user) return configured;
    console.warn("[subs-notifications] SUBS_NOTIFICATIONS_INBOX_USER_ID не найден в Subs Auth, игнорируем.");
  }

  const inboxEmails = staffInboxEmailsFromEnv();
  if (!inboxEmails.length) return null;

  const { data, error } = await subs.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error || !data?.users?.length) return null;

  for (const want of inboxEmails) {
    const match = data.users.find((u) => (u.email ?? "").trim().toLowerCase() === want);
    if (match?.id) return match.id;
  }
  return null;
}

async function subsAuthUserExists(
  subs: NonNullable<ReturnType<typeof createSubsStoreAdminClient>>,
  userId: string
): Promise<boolean> {
  const { data, error } = await subs.auth.admin.getUserById(userId);
  if (error) return false;
  return Boolean(data.user);
}

/**
 * Возвращает true, если сессия относится к Subs Store (site_id = UUID subs-store в GPT БД).
 */
export async function isChatSessionForSubsStore(siteId: string | null | undefined): Promise<boolean> {
  if (!siteId) return false;
  const subsUuid = await getSiteUUID("subs-store");
  return Boolean(subsUuid && siteId === subsUuid);
}

export async function insertSubsStoreNotification(params: {
  recipientUserId: string;
  type: SubsNotificationInsertType;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const subs = createSubsStoreAdminClient();
  if (!subs) return { ok: false, reason: "subs_not_configured" };

  const exists = await subsAuthUserExists(subs, params.recipientUserId);
  if (!exists) return { ok: false, reason: "recipient_not_in_subs_auth" };

  const entityType = params.entity_type ?? null;
  const entityId = params.entity_id ?? null;
  if (entityId && entityType) {
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { data: existing } = await subs
      .from("notifications")
      .select("id")
      .eq("recipient_user_id", params.recipientUserId)
      .eq("type", params.type)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .gte("created_at", since)
      .limit(1);
    if (existing?.length) return { ok: true };
  }

  const row: Record<string, unknown> = {
    recipient_user_id: params.recipientUserId,
    recipient_role: null,
    type: params.type,
    title: params.title.trim().slice(0, 500),
    message: clipMessage(params.message),
    is_read: false,
    entity_type: entityType,
    entity_id: entityId,
    metadata: {} as Json,
    email_sent: false,
  };

  const { error } = await subs.from("notifications").insert(row);
  if (error) {
    console.error("[subs-notifications] insert failed:", error.message);
    return { ok: false, reason: error.message };
  }
  return { ok: true };
}

/** Новое сообщение клиента в чате Subs — уведомление «в ящик» для персонала (строка в Subs notifications). */
export async function notifySubsStoreStaffInboxNewChatMessage(params: {
  sessionId: string;
  clientUserId: string | null;
  messagePreview: string;
  clientEmail?: string | null;
}): Promise<void> {
  const preview = clipMessage(params.messagePreview || "—", 400);
  const who = params.clientEmail?.trim() || params.clientUserId || "гость";

  const { recordSubsStaffNotification } = await import("@/lib/notifications/staff-events");
  await recordSubsStaffNotification({
    type: "new_chat_message",
    title: "Subs Store: новое сообщение в чате",
    message: `Клиент (${who}): ${preview}`,
    entity_type: "chat_thread",
    entity_id: params.sessionId,
    emailSubject: "💬 Клиент написал в чат — Subs Store",
    emailBody: `Новое сообщение в Subs Store\nКлиент: ${who}\nТекст: ${preview}\n\nОператор: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3056"}/operator/chat?site=subs-store&thread_id=${params.sessionId}\nАдмин: ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3056"}/admin/chat?site=subs-store&thread_id=${params.sessionId}`,
  });
}

/** Новый заказ / оплата / ошибка — Subs Store. */
export async function notifySubsStoreStaffOrderEvent(params: {
  type: "new_order" | "payment_success" | "payment_failed" | "order_problem";
  title: string;
  message: string;
  orderId?: string;
  emailSubject: string;
  emailBody: string;
}): Promise<void> {
  const { recordSubsStaffNotification } = await import("@/lib/notifications/staff-events");
  await recordSubsStaffNotification({
    type: params.type,
    title: params.title,
    message: params.message,
    entity_type: params.orderId ? "order" : null,
    entity_id: params.orderId ?? null,
    emailSubject: params.emailSubject,
    emailBody: params.emailBody,
  });
}

/** Ответ оператора/админа — уведомление клиенту в Subs Auth (если его UUID есть в Subs). */
export async function notifySubsStoreCustomerChatReply(params: {
  sessionId: string;
  customerUserId: string | null | undefined;
  messagePreview: string;
}): Promise<void> {
  const subs = createSubsStoreAdminClient();
  if (!subs || !params.customerUserId) return;

  const ok = await subsAuthUserExists(subs, params.customerUserId);
  if (!ok) return;

  await insertSubsStoreNotification({
    recipientUserId: params.customerUserId,
    type: "chat_reply",
    title: "Вам ответила поддержка Subs Store",
    message: clipMessage(params.messagePreview || "—", 400),
    entity_type: "chat_thread",
    entity_id: params.sessionId,
  });
}

function orderNotificationType(status: string): SubsNotificationInsertType {
  if (status === "awaiting_data") return "order_needs_data";
  if (status === "problem" || status === "refund" || status === "cancelled") return "order_problem";
  if (status === "paid" || status === "processing") return "payment_success";
  if (status === "activated" || status === "completed") return "order_activated";
  return "order_activated";
}

/** Смена статуса заказа — уведомление клиенту в кабинете. */
export async function notifySubsStoreCustomerOrderStatus(params: {
  orderId: string;
  customerUserId: string | null | undefined;
  status: string;
  planLabel?: string | null;
}): Promise<void> {
  if (!params.customerUserId) return;

  const label = subsOrderStatusLabelRu(params.status);
  const plan = params.planLabel?.trim() || "Spotify Premium";

  await insertSubsStoreNotification({
    recipientUserId: params.customerUserId,
    type: orderNotificationType(params.status),
    title: `Заказ: ${label}`,
    message: `${plan} · обновление статуса`,
    entity_type: "order",
    entity_id: params.orderId,
  });
}
