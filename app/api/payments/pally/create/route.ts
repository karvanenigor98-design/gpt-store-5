import { NextRequest, NextResponse } from "next/server";

import { resolveGptCheckoutPlan, upsertGptPendingOrder } from "@/lib/checkout/resolve-gpt-checkout";
import { ensureGptProfile } from "@/lib/orders/create-gpt-order";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { buildPallyRedirectUrls, createPallyPayment } from "@/lib/payments/pally";
import { scheduleUnpaidOrderReminder } from "@/lib/email/schedule-unpaid-reminder";
import {
  notifyCustomerOrderCreated,
  notifyNewOrder,
  notifyOperationalFailure,
} from "@/lib/telegram/notifications";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const body = (await request.json()) as {
      planId?: string;
      accountEmail?: string;
      promoCode?: string | null;
      orderId?: string | null;
    };
    const { planId, accountEmail, promoCode, orderId } = body;

    if (!planId || !accountEmail) {
      return NextResponse.json(
        { error: "Укажите тариф и email аккаунта ChatGPT" },
        { status: 400 },
      );
    }

    const resolvedPlan = await resolveGptCheckoutPlan(planId, promoCode);
    if (!resolvedPlan.ok) {
      return NextResponse.json(
        { error: resolvedPlan.error },
        { status: resolvedPlan.status },
      );
    }

    const { plan, finalPrice } = resolvedPlan.resolved;
    const admin = createAdminClient();
    await ensureGptProfile(admin, user);

    const { order, error: orderError, created } = await upsertGptPendingOrder(admin, {
      userId: user.id,
      accountEmail: accountEmail.trim(),
      resolved: resolvedPlan.resolved,
      existingOrderId: orderId,
    });

    if (orderError || !order) {
      console.error("[Checkout] Ошибка создания заказа:", orderError);
      return NextResponse.json(
        { error: orderError ?? "Ошибка создания заказа" },
        { status: 500 },
      );
    }

    if (created) {
      await notifyNewOrder(
        {
          id: order.id,
          plan_name: plan.name,
          price: finalPrice,
          account_email: accountEmail,
          product: plan.productId ?? "chatgpt-plus",
        },
        { email: user.email ?? null },
        { siteSlug: "gpt-store" },
      ).catch(() => {});
    }

    const { getPublicSiteOrigin } = await import("@/lib/app-url");
    const appUrl = getPublicSiteOrigin();
    const { successUrl, failUrl } = buildPallyRedirectUrls(appUrl, "gpt-store");

    let payment: { paymentId: string; paymentUrl: string };
    try {
      payment = await createPallyPayment({
        orderId: order.id,
        amount: finalPrice,
        description: `GPT STORE: ${plan.name}`,
        successUrl,
        failUrl,
        webhookUrl: `${appUrl}/api/payments/pally/webhook`,
        customerEmail: user.email ?? undefined,
        site: "gpt-store",
      });
    } catch (payErr) {
      const detail = payErr instanceof Error ? payErr.message : undefined;
      await notifyOperationalFailure({
        context: "Ошибка создания платежа Pally",
        detail,
      }).catch(() => {});

      return NextResponse.json(
        {
          error: detail ?? "Не удалось создать ссылку на оплату",
          orderId: order.id,
          orderSaved: true,
        },
        { status: 503 },
      );
    }

    await admin
      .from("orders")
      .update({ payment_id: payment.paymentId, pally_order_id: payment.paymentId })
      .eq("id", order.id);

    if (user.email) {
      await notifyCustomerOrderCreated({
        customerEmail: user.email,
        customerUserId: user.id,
        orderId: order.id,
        planName: plan.name,
        price: finalPrice,
        accountEmail,
        siteSlug: "gpt-store",
      }).catch(() => {});
      await scheduleUnpaidOrderReminder({
        siteSlug: "gpt-store",
        orderId: order.id,
        recipientEmail: user.email,
        planName: plan.name,
        price: finalPrice,
      }).catch(() => {});
    }

    return NextResponse.json({ paymentUrl: payment.paymentUrl, orderId: order.id });
  } catch (err) {
    console.error("[Checkout] Ошибка:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Внутренняя ошибка" },
      { status: 500 },
    );
  }
}
