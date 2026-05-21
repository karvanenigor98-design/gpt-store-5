export type EmailEventType =
  | "chat_staff_reply"
  | "chat_client_message"
  | "order_created"
  | "order_status_changed"
  | "order_paid"
  | "payment_received"
  | "payment_failed"
  | "subscription_activated"
  | "subscription_expiring"
  | "subscription_expired"
  | "review_request"
  | "new_review"
  | "promocode_used"
  | "order_problem"
  | "staff_new_order"
  | "staff_manual_status";

export type EmailSettingsCategory =
  | "chat"
  | "orders"
  | "payments"
  | "reviews"
  | "promocodes";

export function eventCategory(event: EmailEventType): EmailSettingsCategory {
  if (event.startsWith("chat_")) return "chat";
  if (event === "new_review" || event === "review_request") return "reviews";
  if (event === "promocode_used") return "promocodes";
  if (
    event === "order_paid" ||
    event === "payment_received" ||
    event === "payment_failed" ||
    event === "order_problem"
  ) {
    return "payments";
  }
  return "orders";
}
