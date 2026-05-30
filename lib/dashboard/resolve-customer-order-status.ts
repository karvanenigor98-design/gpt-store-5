import type { SiteSlug } from "@/lib/sites";
import { isPaidLikeStatus } from "@/lib/orders/paid-like-status";
import { coerceOrderStatus } from "@/lib/dashboard/order-status-tracker";

const UNPAID_STATUSES = new Set([
  "pending",
  "awaiting_payment",
  "new",
  "pending_payment_setup",
]);

/** Эффективный статус для UI: если оплата прошла, но status в БД ещё «ожидает оплаты». */
export function resolveCustomerOrderStatus(params: {
  siteSlug: SiteSlug;
  status: string | null | undefined;
  paymentStatus?: string | null;
}): string {
  const raw = coerceOrderStatus(params.status);
  const paymentStatus = (params.paymentStatus ?? "").trim().toLowerCase();

  if (params.siteSlug === "subs-store") {
    if (paymentStatus === "paid" && UNPAID_STATUSES.has(raw)) {
      return "processing";
    }
    if (isPaidLikeStatus(raw, "subs-store")) {
      return raw;
    }
    return raw;
  }

  if (paymentStatus === "paid" && UNPAID_STATUSES.has(raw)) {
    return "activating";
  }

  return raw;
}

export function isCustomerOrderPaidLike(params: {
  siteSlug: SiteSlug;
  status: string | null | undefined;
  paymentStatus?: string | null;
}): boolean {
  const effective = resolveCustomerOrderStatus(params);
  if (params.siteSlug === "subs-store" && (params.paymentStatus ?? "").trim().toLowerCase() === "paid") {
    return true;
  }
  return isPaidLikeStatus(effective, params.siteSlug);
}
