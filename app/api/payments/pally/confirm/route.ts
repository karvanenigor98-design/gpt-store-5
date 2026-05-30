import { NextRequest, NextResponse } from "next/server";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
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

/** После success_url Pally: подтянуть оплату, если webhook задержался. */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { orderId?: string; site?: string };
    const orderId = body.orderId?.trim();
    const siteSlug: SiteSlug = body.site === "subs-store" ? "subs-store" : "gpt-store";

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    let bundle;
    try {
      bundle = await createSiteSessionClient(siteSlug);
    } catch {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const {
      data: { user },
    } = await bundle.browserLike.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const owns = await userOwnsOrder(siteSlug, orderId, user.id, user.email ?? null);
    if (!owns) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await reconcileUnpaidOrderPayment({ siteSlug, orderId });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[pally/confirm]", err);
    return NextResponse.json({ error: "Confirm failed" }, { status: 500 });
  }
}
