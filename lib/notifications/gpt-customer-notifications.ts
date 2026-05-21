import { getSiteUUID } from "@/lib/admin/getSiteId";
import { createAdminClient } from "@/lib/supabase/server";
import type { NotificationType, OrderStatus } from "@/types/database";

function clipMessage(text: string, max = 400): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const GPT_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  activating: "Активируется",
  waiting_client: "Ожидает данных",
  active: "Активен",
  failed: "Ошибка",
  expired: "Истёк",
  refunded: "Возврат",
};

function orderNotificationType(status: OrderStatus): NotificationType {
  if (status === "waiting_client") return "order_needs_data";
  if (status === "failed") return "order_problem";
  if (status === "paid" || status === "activating") return "payment_success";
  if (status === "active") return "order_activated";
  return "order_activated";
}

export async function insertGptCustomerNotification(params: {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type?: string | null;
  entity_id?: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();
    const siteId = await getSiteUUID("gpt-store");

    const { error } = await admin.from("notifications").insert({
      site_id: siteId,
      recipient_user_id: params.recipientUserId,
      recipient_role: "client",
      type: params.type,
      title: params.title.trim().slice(0, 500),
      message: clipMessage(params.message, 2000),
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      is_read: false,
    });

    if (error) {
      console.error("[gpt-customer-notifications] insert:", error.message);
    }
  } catch (err) {
    console.error("[gpt-customer-notifications] insert:", err);
  }
}

export async function notifyGptCustomerChatReply(params: {
  sessionId: string;
  customerUserId: string | null | undefined;
  messagePreview: string;
}): Promise<void> {
  if (!params.customerUserId) return;

  await insertGptCustomerNotification({
    recipientUserId: params.customerUserId,
    type: "chat_reply",
    title: "Вам ответила поддержка GPT STORE",
    message: clipMessage(params.messagePreview || "—"),
    entity_type: "chat_session",
    entity_id: params.sessionId,
  });
}

export async function notifyGptCustomerOrderStatus(params: {
  orderId: string;
  customerUserId: string | null | undefined;
  status: OrderStatus;
  planLabel?: string | null;
}): Promise<void> {
  if (!params.customerUserId) return;

  const label = GPT_STATUS_LABELS[params.status] ?? params.status;
  const plan = params.planLabel?.trim() || "Подписка";

  await insertGptCustomerNotification({
    recipientUserId: params.customerUserId,
    type: orderNotificationType(params.status),
    title: `Заказ: ${label}`,
    message: `${plan} · обновление статуса`,
    entity_type: "order",
    entity_id: params.orderId,
  });
}
