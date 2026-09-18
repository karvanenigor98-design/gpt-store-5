import type { SiteSlug } from "@/lib/auth/siteUiSession";
import {
  CHECKOUT_RETURN_COOKIE,
  parseCheckoutReturnCookieValue,
} from "@/lib/payments/checkout-return-cookie";
import { resolveCheckoutSiteSlug } from "@/lib/payments/resolve-checkout-site";
import { createAdminClient } from "@/lib/supabase/server";

const ORDER_QUERY_KEYS = [
  "order",
  "orderId",
  "order_id",
  "orderid",
  "InvId",
  "inv_id",
  "invid",
  "invoice_id",
  "bill_id",
  "payment_id",
  "PaymentId",
  "TrsId",
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PALLY_ID_RE = /^[a-zA-Z0-9._-]{6,80}$/;

function flattenParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return value?.trim() || undefined;
}

function pickOrderId(params: Record<string, string | string[] | undefined>): string | null {
  const lower = new Map<string, string>();
  for (const [key, raw] of Object.entries(params)) {
    const value = flattenParam(raw);
    if (value) lower.set(key.toLowerCase(), value);
  }

  for (const key of ORDER_QUERY_KEYS) {
    const value = lower.get(key.toLowerCase());
    if (value) return value;
  }

  for (const value of lower.values()) {
    if (UUID_RE.test(value)) return value;
  }

  return null;
}

async function resolveGptOrderIdFromPallyParam(raw: string): Promise<string | null> {
  const value = raw.trim();
  if (UUID_RE.test(value)) return value;
  if (!PALLY_ID_RE.test(value)) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("id")
    .or(`payment_id.eq.${value},pally_order_id.eq.${value}`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
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
  [key: string]: string | string[] | undefined;
}): Promise<{ orderId: string | null; siteSlug: SiteSlug }> {
  const siteSlug = await resolveCheckoutSiteSlug(flattenParam(params.site));
  const fromQuery = pickOrderId(params);

  if (fromQuery) {
    if (siteSlug === "gpt-store") {
      const mapped = await resolveGptOrderIdFromPallyParam(fromQuery);
      return { orderId: mapped ?? (UUID_RE.test(fromQuery) ? fromQuery : null), siteSlug };
    }
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
