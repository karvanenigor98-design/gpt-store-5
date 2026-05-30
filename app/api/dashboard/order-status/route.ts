import { NextRequest, NextResponse } from "next/server";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { customerOrderStatusLabelRu } from "@/lib/dashboard/customer-order-status-display";
import {
  isCustomerOrderPaidLike,
  resolveCustomerOrderStatus,
} from "@/lib/dashboard/resolve-customer-order-status";
import { getCheckoutOrderPaymentState } from "@/lib/payments/get-checkout-order-status";
import { canAccessOrderStatus } from "@/lib/payments/order-status-access";

export const maxDuration = 15;

/** Живой статус заказа для кабинета (service role + проверка владельца). */
export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get("orderId")?.trim();
    const siteParam = request.nextUrl.searchParams.get("site");
    const siteSlug: SiteSlug = siteParam === "subs-store" ? "subs-store" : "gpt-store";

    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const allowed = await canAccessOrderStatus(orderId, siteSlug);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const state = await getCheckoutOrderPaymentState(siteSlug, orderId);
    if (!state) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const effectiveStatus = resolveCustomerOrderStatus({
      siteSlug,
      status: state.status,
      paymentStatus: state.paymentStatus,
    });

    return NextResponse.json({
      status: state.status,
      payment_status: state.paymentStatus ?? null,
      effectiveStatus,
      displayStatus: customerOrderStatusLabelRu(siteSlug, effectiveStatus),
      paidLike: isCustomerOrderPaidLike({
        siteSlug,
        status: state.status,
        paymentStatus: state.paymentStatus,
      }),
    });
  } catch (err) {
    console.error("[dashboard/order-status]", err);
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
