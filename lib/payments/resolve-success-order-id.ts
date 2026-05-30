import type { SiteSlug } from "@/lib/auth/siteUiSession";
import {
  CHECKOUT_RETURN_COOKIE,
  parseCheckoutReturnCookieValue,
} from "@/lib/payments/checkout-return-cookie";

const ORDER_QUERY_KEYS = [
  "order",
  "orderId",
  "order_id",
  "orderid",
  "InvId",
  "inv_id",
  "invoice_id",
  "bill_id",
] as const;

function pickOrderId(params: Record<string, string | undefined>): string | null {
  for (const key of ORDER_QUERY_KEYS) {
    const value = params[key]?.trim();
    if (value) return value;
  }
  return null;
}

export async function resolveCheckoutSuccessContext(params: {
  order?: string;
  orderId?: string;
  order_id?: string;
  site?: string;
  InvId?: string;
  inv_id?: string;
  invoice_id?: string;
  bill_id?: string;
  orderid?: string;
}): Promise<{ orderId: string | null; siteSlug: SiteSlug }> {
  const siteSlug: SiteSlug = params.site === "subs-store" ? "subs-store" : "gpt-store";
  const fromQuery = pickOrderId(params);

  if (fromQuery) {
    return { orderId: fromQuery, siteSlug };
  }

  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const parsed = parseCheckoutReturnCookieValue(jar.get(CHECKOUT_RETURN_COOKIE)?.value);
  if (parsed) {
    return parsed;
  }

  return { orderId: null, siteSlug };
}

export { CHECKOUT_RETURN_COOKIE };
