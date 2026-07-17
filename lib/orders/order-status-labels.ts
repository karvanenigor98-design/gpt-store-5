/**
 * Unified order status dictionary (RU labels).
 * DB values stay English; UI/email/Telegram must use these helpers.
 */

import {
  GPT_ORDER_STATUS_LABELS,
  GPT_ORDER_STATUSES,
  gptOrderStatusLabelRu,
} from "@/lib/admin/gpt-order-status-labels";
import {
  SUBS_ORDER_STATUS_LABELS,
  SUBS_ORDER_STATUSES,
  subsOrderStatusLabelRu,
} from "@/lib/admin/subs-order-status-labels";
import type { SiteSlug } from "@/lib/sites";

export {
  GPT_ORDER_STATUS_LABELS,
  GPT_ORDER_STATUSES,
  gptOrderStatusLabelRu,
  SUBS_ORDER_STATUS_LABELS,
  SUBS_ORDER_STATUSES,
  subsOrderStatusLabelRu,
};

/** Payment-provider-facing / generic statuses that may appear in notifications. */
export const PAYMENT_STATUS_LABELS_RU: Record<string, string> = {
  pending: "Ожидает оплаты",
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплата получена",
  failed: "Ошибка оплаты",
  refunded: "Возврат",
  cancelled: "Отменён",
  processing: "Активация подписки",
  completed: "Завершён",
  activated: "Активировано",
  active: "Активировано",
};

export function paymentStatusLabelRu(status: string): string {
  return PAYMENT_STATUS_LABELS_RU[status] ?? "Неизвестный статус";
}

export function orderStatusLabelRu(siteSlug: SiteSlug | string, status: string): string {
  if (siteSlug === "subs-store") return subsOrderStatusLabelRu(status);
  const gpt = gptOrderStatusLabelRu(status);
  if (gpt !== "Неизвестный статус") return gpt;
  return paymentStatusLabelRu(status);
}
