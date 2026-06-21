import { NextRequest, NextResponse } from "next/server";

import { resolveGptCheckoutPlan, upsertGptPendingOrder } from "@/lib/checkout/resolve-gpt-checkout";
import { ensureGptProfile } from "@/lib/orders/create-gpt-order";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { appendCheckoutReturnCookie } from "@/lib/payments/checkout-return-cookie";
import { buildPallyRedirectUrls, createPallyPayment } from "@/lib/payments/pally";
import { scheduleUnpaidOrderReminder } from "@/lib/email/schedule-unpaid-reminder";
import { insertGptCustomerNotification } from "@/lib/notifications/gpt-customer-notifications";
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

    if (!planId) {
      return NextResponse.json(
        { error: "Укажите тариф" },
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

    const { order, error: orderError } = await upsertGptPendingOrder(admin, {
      userId: user.id,
      accountEmail: accountEmail?.trim() || user.email?.trim() || null,
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

    await insertGptCustomerNotification({
      recipientUserId: user.id,
      type: "new_order",
      title: "Заказ создан",
      message: `${plan.name} · ${finalPrice} ₽`,
      entity_type: "order",
      entity_id: order.id,
    }).catch(() => {});

    const { getPallyAppUrlFromRequest } = await import("@/lib/app-url");
    const appUrl = getPallyAppUrlFromRequest(request, "gpt-store");
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
      void notifyOperationalFailure({
        context: "Ошибка создания платежа Pally",
        detail,
        siteSlug: "gpt-store",
      });

      return appendCheckoutReturnCookie(
        NextResponse.json(
          {
            error: detail ?? "Не удалось создать ссылку на оплату",
            orderId: order.id,
            orderSaved: true,
          },
          { status: 503 },
        ),
        "gpt-store",
        order.id,
      );
    }

    await admin
      .from("orders")
      .update({
        payment_id: payment.paymentId,
        pally_order_id: payment.paymentId,
      })
      .eq("id", order.id);

    const accountEmailValue = accountEmail?.trim() || user.email || null;
    await notifyNewOrder(
      {
        id: order.id,
        plan_name: plan.name,
        price: finalPrice,
        account_email: accountEmailValue,
        product: plan.productId ?? "chatgpt-plus",
      },
      { email: user.email ?? null },
      { siteSlug: "gpt-store" },
    ).catch(() => {});

    if (user.email) {
      await notifyCustomerOrderCreated({
        customerEmail: user.email,
        customerUserId: user.id,
        orderId: order.id,
        planName: plan.name,
        price: finalPrice,
        accountEmail: accountEmail?.trim() || undefined,
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

    const response = NextResponse.json({ paymentUrl: payment.paymentUrl, orderId: order.id });
    return appendCheckoutReturnCookie(response, "gpt-store", order.id);
  } catch (err) {
    console.error("[Checkout] Ошибка:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Внутренняя ошибка" },
      { status: 500 },
    );
  }
}
