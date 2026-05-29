/** Русские подписи статусов заказа Subs Store (значения в БД — на английском). */

export const SUBS_ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  awaiting_payment: "Ожидает оплаты",
  pending_payment_setup: "Оплата в настройке",
  awaiting_operator: "Ожидает оператора",
  paid: "Оплата получена",
  processing: "Активация подписки",
  awaiting_data: "Ожидаем данные",
  activated: "Активировано",
  completed: "Завершён",
  problem: "Проблема",
  refund: "Возврат",
  cancelled: "Отменён",
};

export const SUBS_ORDER_STATUSES = [
  "new",
  "awaiting_payment",
  "pending_payment_setup",
  "awaiting_operator",
  "paid",
  "processing",
  "awaiting_data",
  "activated",
  "completed",
  "problem",
  "refund",
  "cancelled",
] as const;

export function subsOrderStatusLabelRu(status: string): string {
  return SUBS_ORDER_STATUS_LABELS[status] ?? status;
}
