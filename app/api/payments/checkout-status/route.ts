import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import {
  CHECKOUT_RETURN_COOKIE,
  parseCheckoutReturnCookieValue,
} from "@/lib/payments/checkout-return-cookie";
import { getCheckoutOrderPaymentState } from "@/lib/payments/get-checkout-order-status";
import { reconcileUnpaidOrderPayment } from "@/lib/payments/reconcile-unpaid-order";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export const maxDuration = 30;

async function userOwnsOrder(
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
      .select("user_id,customer_email")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return false;
    if (order.user_id === userId) return true;
    return Boolean(email && order.customer_email?.trim().toLowerCase() === email);
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("user_id,account_email")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return false;
  if (order.user_id === userId) return true;
  return Boolean(email && order.account_email?.trim().toLowerCase() === email);
}

async function canPollCheckoutOrder(orderId: string, siteSlug: SiteSlug): Promise<boolean> {
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

/** Polling со страницы ожидания оплаты (cookie checkout или авторизованный владелец). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { orderId?: string; site?: string };
    const orderId = body.orderId?.trim();
    const siteSlug: SiteSlug = body.site === "subs-store" ? "subs-store" : "gpt-store";

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const allowed = await canPollCheckoutOrder(orderId, siteSlug);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await reconcileUnpaidOrderPayment({ siteSlug, orderId }).catch(() => undefined);

    const state = await getCheckoutOrderPaymentState(siteSlug, orderId);
    if (!state) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: state.status,
      paidLike: state.paidLike,
    });
  } catch (err) {
    console.error("[checkout-status]", err);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
