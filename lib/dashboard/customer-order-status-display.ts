import type { SiteSlug } from "@/lib/sites";
import { coerceOrderStatus } from "@/lib/dashboard/order-status-tracker";

/** Клиентские подписи статуса в кабинете (не админка). */
const CUSTOMER_STATUS_LABELS: Record<SiteSlug, Record<string, string>> = {
  "gpt-store": {
    pending: "Ожидает оплаты",
    paid: "Оплата получена",
    activating: "Активация подписки",
    waiting_client: "Ожидаем данные",
    active: "Активировано",
    failed: "Ошибка",
    expired: "Истёк",
    refunded: "Возврат",
  },
  "subs-store": {
    new: "Ожидает оплаты",
    awaiting_payment: "Ожидает оплаты",
    pending_payment_setup: "Ожидает оплаты",
    paid: "Оплата получена",
    processing: "Активация подписки",
    awaiting_operator: "Активация подписки",
    awaiting_data: "Ожидаем данные",
    activated: "Активировано",
    completed: "Активировано",
    problem: "Проблема",
    refund: "Возврат",
    cancelled: "Отменён",
    activating: "Активация подписки",
  },
};

/** Цвет badge в кабинете (tailwind classes). */
export function customerOrderStatusBadgeColor(
  siteSlug: SiteSlug,
  status: string,
  variant: "light" | "subs" = siteSlug === "subs-store" ? "subs" : "light",
): string {
  const s = coerceOrderStatus(status);
  const isSubs = variant === "subs";

  if (["pending", "awaiting_payment", "new", "pending_payment_setup"].includes(s)) {
    return isSubs
      ? "text-yellow-200 bg-yellow-500/15 border-yellow-500/30"
      : "text-amber-600 bg-amber-50 border-amber-200";
  }
  if (["waiting_client", "awaiting_data"].includes(s)) {
    return isSubs
      ? "text-orange-200 bg-orange-500/15 border-orange-500/30"
      : "text-orange-600 bg-orange-50 border-orange-200";
  }
  if (["activating", "processing", "awaiting_operator"].includes(s)) {
    return isSubs
      ? "text-sky-200 bg-sky-500/15 border-sky-500/30"
      : "text-blue-600 bg-blue-50 border-blue-200";
  }
  if (["paid"].includes(s)) {
    return isSubs
      ? "text-emerald-200 bg-emerald-500/20 border-emerald-500/30"
      : "text-green-600 bg-[#10a37f]/8 border-[#10a37f]/20";
  }
  if (["active", "activated", "completed"].includes(s)) {
    return isSubs
      ? "text-emerald-200 bg-emerald-500/20 border-emerald-500/30"
      : "text-green-600 bg-[#10a37f]/8 border-[#10a37f]/20";
  }
  if (["failed", "problem"].includes(s)) {
    return isSubs
      ? "text-red-200 bg-red-500/15 border-red-500/30"
      : "text-red-600 bg-red-50 border-red-200";
  }
  if (["refunded", "refund", "expired", "cancelled"].includes(s)) {
    return isSubs
      ? "text-gray-300 bg-white/10 border-white/15"
      : "text-gray-500 bg-gray-50 border-gray-200";
  }

  return isSubs
    ? "text-yellow-200 bg-yellow-500/15 border-yellow-500/30"
    : "text-amber-600 bg-amber-50 border-amber-200";
}

export function customerOrderStatusLabelRu(siteSlug: SiteSlug, status: string): string {
  const s = coerceOrderStatus(status);
  const map = CUSTOMER_STATUS_LABELS[siteSlug];
  return map[s] ?? s;
}

/** Стили badge для страницы заказов. */
export function buildCustomerStatusStyles(
  siteSlug: SiteSlug,
): Record<string, { label: string; color: string }> {
  const variant = siteSlug === "subs-store" ? "subs" : "light";
  const keys =
    siteSlug === "subs-store"
      ? [
          "new",
          "awaiting_payment",
          "pending_payment_setup",
          "processing",
          "awaiting_data",
          "awaiting_operator",
          "activating",
          "activated",
          "completed",
          "problem",
          "refund",
          "cancelled",
        ]
      : [
          "pending",
          "activating",
          "waiting_client",
          "active",
          "failed",
          "expired",
          "refunded",
          "paid",
        ];

  const out: Record<string, { label: string; color: string }> = {};
  for (const key of keys) {
    out[key] = {
      label: customerOrderStatusLabelRu(siteSlug, key),
      color: customerOrderStatusBadgeColor(siteSlug, key, variant),
    };
  }
  return out;
}
