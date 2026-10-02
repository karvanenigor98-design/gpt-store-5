import type { SiteSlug } from "@/lib/sites";
import { isPaidLikeStatus } from "@/lib/orders/paid-like-status";

export type LoyaltyTier = {
  name: "Новичок" | "Бронзовый" | "Серебряный" | "Золотой";
  discount: number;
  nextAt: number | null;
};

const LOYALTY_FAIL = new Set([
  "pending",
  "awaiting_payment",
  "failed",
  "expired",
  "refunded",
  "cancelled",
  "canceled",
  "problem",
]);

/** Заказы, которые копят ранг: оплаты и активации, не черновики. */
export function isLoyaltyCompletedStatus(status: string, siteSlug: SiteSlug): boolean {
  const s = status.trim().toLowerCase();
  if (LOYALTY_FAIL.has(s)) return false;
  return isPaidLikeStatus(s, siteSlug);
}

export function countLoyaltyCompletedOrders(
  orders: Array<{ status: string }>,
  siteSlug: SiteSlug,
): number {
  return orders.filter((o) => isLoyaltyCompletedStatus(o.status, siteSlug)).length;
}

export function getBonusTier(completed: number): LoyaltyTier {
  if (completed >= 10) return { name: "Золотой", discount: 15, nextAt: null };
  if (completed >= 5) return { name: "Серебряный", discount: 10, nextAt: 10 };
  if (completed >= 3) return { name: "Бронзовый", discount: 5, nextAt: 5 };
  return { name: "Новичок", discount: 0, nextAt: 3 };
}
