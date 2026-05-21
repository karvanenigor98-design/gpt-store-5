/** Все неоплаченные заказы Subs Store для вкладки «Ожидает оплаты». */
export const SUBS_AWAITING_PAYMENT_OR_FILTER =
  "payment_status.eq.pending,status.in.(awaiting_payment,pending_payment_setup,new)";

export function applySubsOrdersStatusFilter<T extends { or: (f: string) => T; eq: (c: string, v: string) => T }>(
  query: T,
  filterStatus: string | undefined,
): T {
  if (!filterStatus) return query;
  if (filterStatus === "awaiting_payment") {
    return query.eq("payment_status", "pending");
  }
  return query.eq("status", filterStatus);
}
