import type { OrderStatus } from "@/types/database";

/** Подписи статусов GPT Store в админке / у оператора (значения в БД — на английском). */
export const GPT_ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплата получена",
  activating: "Активация подписки",
  waiting_client: "Ожидаем данные",
  active: "Активировано",
  failed: "Ошибка",
  expired: "Истёк",
  refunded: "Возврат",
};

export const GPT_ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "activating",
  "waiting_client",
  "active",
  "failed",
  "expired",
  "refunded",
];

export function gptOrderStatusLabelRu(status: string): string {
  return GPT_ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}
