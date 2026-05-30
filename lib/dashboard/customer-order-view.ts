import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { resolveCustomerOrderStatus } from "@/lib/dashboard/resolve-customer-order-status";
import { coerceOrderStatus } from "@/lib/dashboard/order-status-tracker";

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
  /** Email Spotify-аккаунта (если указан при оформлении). */
  account_email?: string | null;
  customer_email?: string | null;
  /** Название тарифа для отображения (Subs Store). */
  tariff_title?: string | null;
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
  const rawStatus = String(row.status ?? "awaiting_payment");
  const status = resolveCustomerOrderStatus({
    siteSlug: "subs-store",
    status: rawStatus,
    paymentStatus: (row.payment_status as string | null) ?? null,
  });
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
    account_email: (row.account_email as string | null) ?? null,
    tariff_title: tariffTitle ?? null,
  };
}

export function getCustomerOrderProductLabel(order: CustomerOrderView): string {
  if (order.product.startsWith("spotify")) {
    if (order.tariff_title) return `Spotify Premium — ${order.tariff_title}`;
    const suffix = order.plan_id.replace(/^spotify-/, "").replace(/-/g, " ");
    return `Spotify Premium — ${suffix || order.plan_id}`;
  }
  if (order.product === "chatgpt-plus") return "ChatGPT Plus";
  if (order.product === "chatgpt-pro") return "ChatGPT Pro";
  return `${order.product} — ${order.plan_id}`;
}

export function isOrderAwaitingPayment(status: string | null | undefined): boolean {
  const s = coerceOrderStatus(status);
  return s === "pending" || s === "awaiting_payment" || s === "new" || s === "pending_payment_setup";
}

/** Нормализация перед передачей в client components (RSC → props). */
export function sanitizeCustomerOrderView(order: CustomerOrderView): CustomerOrderView {
  return {
    ...order,
    id: String(order.id),
    product: String(order.product ?? "spotify-premium"),
    plan_id: String(order.plan_id ?? ""),
    price: Number(order.price) || 0,
    status: coerceOrderStatus(order.status),
    created_at: String(order.created_at ?? new Date().toISOString()),
    activated_at: order.activated_at ?? null,
    expires_at: order.expires_at ?? null,
    account_email: order.account_email ?? null,
    customer_email: order.customer_email ?? null,
    tariff_title: order.tariff_title ?? null,
  };
}

export { mapOrderStatusToTrackerStep, orderStatusForTracker } from "@/lib/dashboard/order-status-tracker";
export type { OrderTrackerStep } from "@/lib/dashboard/order-status-tracker";

export function buildCustomerOrdersListHref(siteSlug: SiteSlug): string {
  return siteSlug === "subs-store" ? "/dashboard/orders?site=subs-store" : "/dashboard/orders?site=gpt-store";
}

export function buildCustomerOrderFocusHref(siteSlug: SiteSlug, orderId: string): string {
  if (siteSlug === "subs-store") {
    return `/dashboard/orders?site=subs-store&order_id=${encodeURIComponent(orderId)}`;
  }
  return `/dashboard/orders?site=gpt-store&order_id=${encodeURIComponent(orderId)}`;
}
