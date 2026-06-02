import type { SupabaseClient } from "@supabase/supabase-js";

import { markStaffNotificationRead } from "@/lib/admin/staff-notification-reads";

/** Пометить уведомления, привязанные к чату, как прочитанные для текущего staff (per-user). */
export async function markStaffChatNotificationsRead(
  admin: SupabaseClient,
  params: {
    entityId: string;
    userId: string;
  },
): Promise<void> {
  const entityId = params.entityId.trim();
  if (!entityId) return;

  const { data } = await admin
    .from("notifications")
    .select("id")
    .eq("entity_id", entityId)
    .eq("type", "new_chat_message");

  for (const row of data ?? []) {
    await markStaffNotificationRead(admin, {
      notificationId: String((row as { id: string }).id),
      userId: params.userId,
    });
  }
}

/** Пометить уведомления по заказу прочитанными для текущего staff (per-user). */
export async function markStaffOrderNotificationsRead(
  admin: SupabaseClient,
  params: {
    orderId: string;
    userId: string;
  },
): Promise<void> {
  const orderId = params.orderId.trim();
  if (!orderId) return;

  const types = [
    "new_order",
    "payment_success",
    "payment_failed",
    "order_problem",
    "order_activated",
    "order_needs_data",
  ];

  const { data } = await admin
    .from("notifications")
    .select("id")
    .eq("entity_id", orderId)
    .in("type", types);

  for (const row of data ?? []) {
    await markStaffNotificationRead(admin, {
      notificationId: String((row as { id: string }).id),
      userId: params.userId,
    });
  }
}
