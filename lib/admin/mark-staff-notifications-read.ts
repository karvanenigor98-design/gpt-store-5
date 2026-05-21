import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { NotificationType } from "@/types/database";

/** Пометить уведомления, привязанные к чату, как прочитанные (после открытия диалога). */
export async function markStaffChatNotificationsRead(
  entityId: string,
  siteSlug: "gpt-store" | "subs-store",
): Promise<void> {
  if (!entityId.trim()) return;

  if (siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) return;
    await subs
      .from("notifications")
      .update({ is_read: true })
      .eq("entity_id", entityId)
      .eq("type", "new_chat_message")
      .eq("is_read", false);
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("entity_id", entityId)
    .in("type", ["new_chat_message"])
    .eq("is_read", false);
}

/** Пометить уведомления по заказу прочитанными. */
export async function markStaffOrderNotificationsRead(
  orderId: string,
  siteSlug: "gpt-store" | "subs-store",
): Promise<void> {
  if (!orderId.trim()) return;

  const types: NotificationType[] = [
    "new_order",
    "payment_success",
    "payment_failed",
    "order_problem",
    "order_activated",
    "order_needs_data",
  ];

  if (siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) return;
    await subs
      .from("notifications")
      .update({ is_read: true })
      .eq("entity_id", orderId)
      .in("type", types)
      .eq("is_read", false);
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("entity_id", orderId)
    .in("type", types)
    .eq("is_read", false);
}
