import type { SiteSlug } from "@/lib/auth/siteUiSession";

export type ClientNotificationItem = {
  type: string;
  entity_type: string | null;
  entity_id: string | null;
};

const ORDER_TYPES = new Set([
  "order_activated",
  "order_needs_data",
  "order_problem",
  "payment_success",
  "payment_failed",
  "new_order",
]);

export function isClientChatNotification(item: ClientNotificationItem): boolean {
  if (item.type === "chat_reply" || item.type === "new_chat_message") return true;
  return item.entity_type === "chat_thread" || item.entity_type === "chat_session";
}

export function isClientOrderNotification(item: ClientNotificationItem): boolean {
  if (item.entity_type === "order") return true;
  return ORDER_TYPES.has(item.type);
}

export function buildClientNotificationHref(
  siteSlug: SiteSlug,
  item: ClientNotificationItem,
): string {
  const siteQ = `site=${siteSlug}`;

  if (isClientOrderNotification(item) && item.entity_id) {
    if (siteSlug === "subs-store") {
      return `/dashboard/orders?${siteQ}&order_id=${encodeURIComponent(item.entity_id)}`;
    }
    return `/dashboard/orders?site=gpt-store&order_id=${encodeURIComponent(item.entity_id)}`;
  }
  if (isClientChatNotification(item) && item.entity_id) {
    if (siteSlug === "subs-store") {
      return `/dashboard/chat?${siteQ}&thread=${encodeURIComponent(item.entity_id)}`;
    }
    return `/dashboard/chat?${siteQ}&session=${encodeURIComponent(item.entity_id)}`;
  }
  if (isClientChatNotification(item)) {
    return `/dashboard/chat?${siteQ}`;
  }
  if (isClientOrderNotification(item)) {
    return `/dashboard/orders?${siteQ}`;
  }
  return `/dashboard?${siteQ}`;
}
