import { type NextRequest, NextResponse } from "next/server";
import { incrementPromocodeUsage } from "@/lib/promocodes/db-promo";
import { createAdminClient } from "@/lib/supabase/server";
import { mapCryptoStatus } from "@/lib/payments/crypto";
import {
  handleOrderPaidNotification,
  isTransitionToPaidLike,
  resolveGptOrderSiteSlug,
} from "@/lib/notifications/order-paid";
import { notifyCustomerOrderStatus, notifyPaymentStatus } from "@/lib/telegram/notifications";

export async function POST(request: NextRequest) {
  const body = await request.json() as Record<string, unknown>;

  const invoiceId = String(body.invoice_id ?? body.uuid ?? "");
  const status = String(body.status ?? "");

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoice_id" }, { status: 400 });
  }

  const internalStatus = mapCryptoStatus(status);
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("payment_id", invoiceId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const prevStatus = String(order.status);
  const newOrderStatus = (internalStatus === "paid" ? "activating" : internalStatus) as import("@/types/database").OrderStatus;
  const siteSlug = resolveGptOrderSiteSlug(order);

  await supabase.from("orders").update({ status: newOrderStatus }).eq("id", order.id);

  const becamePaidLike = isTransitionToPaidLike(prevStatus, newOrderStatus, siteSlug);
  if (becamePaidLike) {
    const meta = order.meta as Record<string, unknown> | null;
    const promoCode = typeof meta?.promo_code === "string" ? meta.promo_code : null;
    await incrementPromocodeUsage(supabase, promoCode).catch(() => undefined);
  }

  const planTitle = (order as { plan_name?: string | null }).plan_name?.trim() || order.plan_id;

  let customerEmail: string | null = null;
  if (order.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", order.user_id)
      .maybeSingle();
    customerEmail = profile?.email?.trim().toLowerCase() ?? null;
  }

  if (becamePaidLike) {
    void handleOrderPaidNotification({
      orderId: order.id,
      siteSlug,
      planName: planTitle,
      price: order.price,
      status: newOrderStatus,
      customerEmail,
      customerUserId: order.user_id,
      accountEmail: order.account_email ?? undefined,
      paidAt: new Date().toISOString(),
    }).catch(() => undefined);

    await notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price: order.price,
        account_email: order.account_email ?? undefined,
      },
      newOrderStatus,
      { siteSlug, skipStaffInAppAndEmail: true },
    );
  } else {
    await notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price: order.price,
        account_email: order.account_email ?? undefined,
      },
      newOrderStatus,
      { siteSlug },
    );
    if (customerEmail) {
      await notifyCustomerOrderStatus({
        customerEmail,
        customerUserId: order.user_id,
        orderId: order.id,
        planName: planTitle,
        status: newOrderStatus,
        price: order.price,
        siteSlug,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
