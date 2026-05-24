import { NextRequest, NextResponse } from "next/server";

import { incrementSubsPromocodeUsage } from "@/lib/admin/subs-discount-db";
import { incrementPromocodeUsage } from "@/lib/promocodes/db-promo";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyPallyWebhook, mapPallyStatus } from "@/lib/payments/pally";
import {
  handleOrderPaidNotification,
  isTransitionToPaidLike,
  resolveGptOrderSiteSlug,
} from "@/lib/notifications/order-paid";
import { notifyCustomerOrderStatus, notifyPaymentStatus } from "@/lib/telegram/notifications";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const sign =
      request.headers.get("x-pally-sign") ??
      request.headers.get("x-sign") ??
      String(body.sign ?? "");

    if (sign && !verifyPallyWebhook(body, sign)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const orderId = String(body.order_id ?? body.orderId ?? "");
    const pallyStatus = String(body.status ?? "");

    if (!orderId) {
      return NextResponse.json({ error: "Нет order_id" }, { status: 400 });
    }

    const internalStatus = mapPallyStatus(pallyStatus);
    const supabase = createAdminClient();

    const { data: order, error: findError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (findError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const prevStatus = String(order.status);
    const newStatus = internalStatus === "paid" ? "activating" : internalStatus;
    const siteSlug = resolveGptOrderSiteSlug(order);

    await supabase
      .from("orders")
      .update({ status: newStatus as import("@/types/database").OrderStatus })
      .eq("id", orderId);

    const becamePaidLike = isTransitionToPaidLike(prevStatus, newStatus, siteSlug);
    if (becamePaidLike && order.user_id) {
      const { processReferralRewardOnFirstPaidOrder } = await import("@/lib/referrals/db");
      void processReferralRewardOnFirstPaidOrder({
        siteSlug,
        referredUserId: order.user_id,
        orderId: order.id,
      }).catch(() => undefined);
    }

    if (becamePaidLike) {
      const meta = order.meta as Record<string, unknown> | null;
      const promoCode = typeof meta?.promo_code === "string" ? meta.promo_code : null;
      const isSubsOrder = siteSlug === "subs-store";
      if (isSubsOrder) {
        const subs = createSubsStoreAdminClient();
        if (subs) {
          await incrementSubsPromocodeUsage(subs, promoCode).catch(() => undefined);
        }
      } else {
        await incrementPromocodeUsage(supabase, promoCode).catch(() => undefined);
      }
      if (promoCode?.trim()) {
        const { emailStaffPromocodeUsed } = await import("@/lib/email/notify-hooks");
        void emailStaffPromocodeUsed({
          siteSlug,
          code: promoCode.trim(),
          orderId: order.id,
        }).catch(() => undefined);
      }
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
        status: newStatus,
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
        newStatus,
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
        newStatus,
        { siteSlug },
      );
      if (customerEmail) {
        await notifyCustomerOrderStatus({
          customerEmail,
          customerUserId: order.user_id,
          orderId: order.id,
          planName: planTitle,
          status: newStatus,
          price: order.price,
          siteSlug,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Pally webhook]", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
