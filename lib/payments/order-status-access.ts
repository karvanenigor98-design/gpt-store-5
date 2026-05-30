import { cookies } from "next/headers";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import {
  CHECKOUT_RETURN_COOKIE,
  parseCheckoutReturnCookieValue,
} from "@/lib/payments/checkout-return-cookie";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export async function userOwnsOrder(
  siteSlug: SiteSlug,
  orderId: string,
  userId: string,
  userEmail: string | null,
): Promise<boolean> {
  const email = userEmail?.trim().toLowerCase() ?? "";

  if (siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) return false;
    const { data: order } = await subs
      .from("orders")
      .select("user_id,customer_email,account_email")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return false;
    if (order.user_id === userId) return true;
    const customerEmail = order.customer_email?.trim().toLowerCase() ?? "";
    const accountEmail = order.account_email?.trim().toLowerCase() ?? "";
    return Boolean(email && (customerEmail === email || accountEmail === email));
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("user_id,account_email")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return false;
  if (order.user_id === userId) return true;
  const accountEmail = order.account_email?.trim().toLowerCase() ?? "";
  return Boolean(email && accountEmail === email);
}

export async function canAccessOrderStatus(orderId: string, siteSlug: SiteSlug): Promise<boolean> {
  const jar = await cookies();
  const parsed = parseCheckoutReturnCookieValue(jar.get(CHECKOUT_RETURN_COOKIE)?.value);
  if (parsed?.orderId === orderId && parsed.siteSlug === siteSlug) {
    return true;
  }

  try {
    const bundle = await createSiteSessionClient(siteSlug);
    const {
      data: { user },
    } = await bundle.browserLike.auth.getUser();
    if (!user) return false;
    return userOwnsOrder(siteSlug, orderId, user.id, user.email ?? null);
  } catch {
    return false;
  }
}
