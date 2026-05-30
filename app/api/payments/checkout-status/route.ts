import { NextRequest, NextResponse } from "next/server";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { getCheckoutOrderPaymentState } from "@/lib/payments/get-checkout-order-status";
import { canAccessOrderStatus } from "@/lib/payments/order-status-access";
import { reconcileUnpaidOrderPayment } from "@/lib/payments/reconcile-unpaid-order";

export const maxDuration = 30;

/** Polling со страницы ожидания оплаты (cookie checkout или авторизованный владелец). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { orderId?: string; site?: string };
    const orderId = body.orderId?.trim();
    const siteSlug: SiteSlug = body.site === "subs-store" ? "subs-store" : "gpt-store";

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const allowed = await canAccessOrderStatus(orderId, siteSlug);
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
      effectiveStatus: state.effectiveStatus,
      displayStatus: state.displayStatus,
      paidLike: state.paidLike,
    });
  } catch (err) {
    console.error("[checkout-status]", err);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
