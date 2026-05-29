import type { SiteSlug } from "@/lib/auth/siteUiSession";

/** Единый вид заказа для кабинета (GPT + SPOTIFY / subs DB). */
export type CustomerOrderView = {
  id: string;
  product: string;
  plan_id: string;
  price: number;
  status: string;
  created_at: string;
  activated_at?: string | null;
  expires_at?: string | null;
  account_email?: string | null;
  customer_email?: string | null;
};

export function normalizeGptOrderRow(row: Record<string, unknown>): CustomerOrderView {
  return {
    id: String(row.id),
    product: String(row.product ?? ""),
    plan_id: String(row.plan_id ?? ""),
    price: Number(row.price ?? 0),
    status: String(row.status ?? "pending"),
    created_at: String(row.created_at ?? new Date().toISOString()),
    activated_at: (row.activated_at as string | null) ?? null,
    expires_at: (row.expires_at as string | null) ?? null,
    account_email: (row.account_email as string | null) ?? null,
  };
}

export function normalizeSubsOrderRow(
  row: Record<string, unknown>,
  tariffTitle?: string | null,
  tariffSlug?: string | null,
): CustomerOrderView {
  const status = String(row.status ?? "awaiting_payment");
  const slug = tariffSlug ?? String(row.tariff_id ?? "spotify");
  return {
    id: String(row.id),
    product: "spotify-premium",
    plan_id: slug,
    price: Number(row.final_price ?? row.price ?? 0),
    status,
    created_at: String(row.created_at ?? new Date().toISOString()),
    activated_at: (row.activated_at as string | null) ?? null,
    expires_at: (row.expires_at as string | null) ?? null,
    customer_email: (row.customer_email as string | null) ?? null,
    account_email: tariffTitle ?? null,
  };
}

export function getCustomerOrderProductLabel(order: CustomerOrderView): string {
  if (order.product.startsWith("spotify")) {
    if (order.account_email) return `Spotify Premium — ${order.account_email}`;
    const suffix = order.plan_id.replace(/^spotify-/, "").replace(/-/g, " ");
    return `Spotify Premium — ${suffix || order.plan_id}`;
  }
  if (order.product === "chatgpt-plus") return "ChatGPT Plus";
  if (order.product === "chatgpt-pro") return "ChatGPT Pro";
  return `${order.product} — ${order.plan_id}`;
}

export function isOrderAwaitingPayment(status: string): boolean {
  const s = status.toLowerCase();
  return s === "pending" || s === "awaiting_payment";
}

export function orderStatusForTracker(status: string): string {
  if (status === "awaiting_payment") return "pending";
  return status;
}

export function buildCustomerOrdersListHref(siteSlug: SiteSlug): string {
  return siteSlug === "subs-store" ? "/dashboard/orders?site=subs-store" : "/dashboard/orders?site=gpt-store";
}

export function buildCustomerOrderFocusHref(siteSlug: SiteSlug, orderId: string): string {
  if (siteSlug === "subs-store") {
    return `/dashboard/orders?site=subs-store&order_id=${encodeURIComponent(orderId)}`;
  }
  return `/dashboard/orders?site=gpt-store&order_id=${encodeURIComponent(orderId)}`;
}
