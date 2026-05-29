/** Шаги прогресса в кабинете клиента (кружки на карточке заказа). */
export type OrderTrackerStep = "pending" | "activating" | "waiting_client" | "active";

const PAID_OR_WORK = new Set([
  "paid",
  "activating",
  "processing",
  "awaiting_operator",
]);

const NEEDS_CLIENT = new Set(["waiting_client", "awaiting_data"]);

const DONE = new Set(["active", "activated", "completed"]);

const AWAITING_PAY = new Set([
  "pending",
  "awaiting_payment",
  "new",
  "pending_payment_setup",
]);

/** Любой статус БД → шаг трекера (GPT + Spotify / subs). */
export function mapOrderStatusToTrackerStep(status: string): OrderTrackerStep {
  const s = status.trim().toLowerCase();
  if (DONE.has(s)) return "active";
  if (NEEDS_CLIENT.has(s)) return "waiting_client";
  if (PAID_OR_WORK.has(s)) return "activating";
  if (AWAITING_PAY.has(s)) return "pending";
  return "pending";
}

export function orderStatusForTracker(status: string): OrderTrackerStep {
  return mapOrderStatusToTrackerStep(status);
}
