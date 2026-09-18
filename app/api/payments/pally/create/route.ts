import { NextRequest, NextResponse } from "next/server";

import { isGptGuestCheckoutEnabled } from "@/lib/checkout/gpt-guest-checkout-flag";
import {
  isGptUnpaidReuseStatus,
  resolveGptCheckoutPlan,
  upsertGptPendingOrder,
} from "@/lib/checkout/resolve-gpt-checkout";
import {
  isCheckoutContactEmail,
  resolveGptGuestBuyer,
} from "@/lib/checkout/resolve-gpt-guest-buyer";
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

    const body = (await request.json()) as {
      planId?: string;
      accountEmail?: string;
      email?: string;
      promoCode?: string | null;
      orderId?: string | null;
    };
    const { planId, accountEmail, promoCode, orderId } = body;
    const guestEmail = (body.email ?? body.accountEmail)?.trim() || "";

    if (!user && !isGptGuestCheckoutEnabled()) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    if (!planId) {
      return NextResponse.json({ error: "Укажите тариф" }, { status: 400 });
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

    let buyerUserId: string;
    let buyerEmail: string | null;
    let guestCheckout = false;

    if (user) {
      await ensureGptProfile(admin, user);
      buyerUserId = user.id;
      buyerEmail = accountEmail?.trim() || user.email?.trim() || null;
    } else {
      if (!isCheckoutContactEmail(guestEmail)) {
        return NextResponse.json({ error: "Укажите email для заказа" }, { status: 400 });
      }
      const buyer = await resolveGptGuestBuyer(admin, guestEmail);
      if ("error" in buyer) {
        return NextResponse.json({ error: buyer.error }, { status: buyer.status });
      }
      buyerUserId = buyer.userId;
      buyerEmail = buyer.email;
      guestCheckout = true;
    }

    const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = (forwarded || request.headers.get("host") || "").trim();
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    const checkoutOrigin = guestCheckout && host ? `${proto}://${host}` : null;

    const {
      order,
      error: orderError,
      created: createdNew,
    } = await upsertGptPendingOrder(admin, {
      userId: buyerUserId,
      accountEmail: buyerEmail,
      resolved: resolvedPlan.resolved,
      existingOrderId: orderId,
      guestCheckout,
      extraMeta: guestCheckout
        ? { guest_checkout: true, checkout_origin: checkoutOrigin }
        : null,
    });

    if (orderError || !order) {
      console.error("[Checkout] Ошибка создания заказа:", orderError);
      return NextResponse.json(
        { error: orderError ?? "Ошибка создания заказа" },
        { status: 500 },
      );
    }

    if (!isGptUnpaidReuseStatus(order.status)) {
      if (guestCheckout) {
        return NextResponse.json(
          { error: "Не удалось создать платёж. Войдите в аккаунт или укажите другой email." },
          { status: 409 },
        );
      }
      return appendCheckoutReturnCookie(
        NextResponse.json(
          {
            error: "Заказ уже оплачен и обрабатывается. Статус смотрите в личном кабинете.",
            orderId: order.id,
            alreadyOpen: true,
          },
          { status: 409 },
        ),
        "gpt-store",
        order.id,
      );
    }

    if (createdNew) {
      await insertGptCustomerNotification({
        recipientUserId: buyerUserId,
        type: "new_order",
        title: "Заказ создан",
        message: `${plan.name} · ${finalPrice} ₽`,
        entity_type: "order",
        entity_id: order.id,
      }).catch(() => {});
    }

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
        customerEmail: buyerEmail ?? undefined,
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

    if (createdNew) {
      const accountEmailValue = buyerEmail;
      await notifyNewOrder(
        {
          id: order.id,
          plan_name: plan.name,
          price: finalPrice,
          account_email: accountEmailValue,
          product: plan.productId ?? "chatgpt-plus",
        },
        { email: buyerEmail },
        { siteSlug: "gpt-store" },
      ).catch(() => {});

      if (buyerEmail) {
        await notifyCustomerOrderCreated({
          customerEmail: buyerEmail,
          customerUserId: buyerUserId,
          orderId: order.id,
          planName: plan.name,
          price: finalPrice,
          accountEmail: buyerEmail,
          siteSlug: "gpt-store",
        }).catch(() => {});
        await scheduleUnpaidOrderReminder({
          siteSlug: "gpt-store",
          orderId: order.id,
          recipientEmail: buyerEmail,
          planName: plan.name,
          price: finalPrice,
        }).catch(() => {});
      }
    }

    const response = NextResponse.json({
      paymentUrl: payment.paymentUrl,
      orderId: order.id,
      guestCheckout,
    });
    return appendCheckoutReturnCookie(response, "gpt-store", order.id);
  } catch (err) {
    console.error("[Checkout] Ошибка:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Внутренняя ошибка" },
      { status: 500 },
    );
  }
}
