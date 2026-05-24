/** Время последнего просмотра списка заказов (localStorage, per site). */

export type StaffOrdersSite = "gpt-store" | "subs-store";

const key = (site: StaffOrdersSite) => `staff_orders_last_seen:${site}`;

export function getOrdersLastSeenAt(site: StaffOrdersSite): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(site));
    if (!raw) return null;
    const t = Date.parse(raw);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  } catch {
    return null;
  }
}

export function setOrdersLastSeenNow(site: StaffOrdersSite): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(site), new Date().toISOString());
  } catch {
    /* noop */
  }
}
