import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createPallyPayment } from "@/lib/payments/pally";
import { CHATGPT_PLANS } from "@/lib/chatgpt-data";
import { scheduleUnpaidOrderReminder } from "@/lib/email/schedule-unpaid-reminder";
import {
  notifyCustomerOrderCreated,
  notifyNewOrder,
  notifyOperationalFailure,
} from "@/lib/telegram/notifications";
import { applyPromo, findPromo, getStoreConfig, splitPlans } from "@/lib/store-config";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const body = (await request.json()) as { planId?: string; accountEmail?: string; promoCode?: string | null };
    const { planId, accountEmail, promoCode } = body;

    if (!planId || !accountEmail) {
      return NextResponse.json(
        { error: "Укажите тариф и email аккаунта ChatGPT" },
        { status: 400 },
      );
    }

    const config = await getStoreConfig();
    const split = splitPlans(config.plans);
    const allPlans = [...(split.plus ?? CHATGPT_PLANS.plus), ...(split.pro ?? CHATGPT_PLANS.pro)];
    const plan = allPlans.find((p) => p.id === planId);
    if (!plan) {
      return NextResponse.json({ error: "Тариф не найден" }, { status: 400 });
    }
    if (plan.inStock === false) {
      return NextResponse.json({ error: "Этот тариф временно отсутствует в наличии" }, { status: 400 });
    }

    const promo = findPromo(config.promoCodes, promoCode, plan.id);
    if (promoCode?.trim() && !promo) {
      return NextResponse.json(
        { error: "Промокод недействителен или не подходит к этому тарифу" },
        { status: 400 },
      );
    }
    const { finalPrice, discountValue } = applyPromo(plan.price, promo);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        product: plan.productId ?? "chatgpt-plus",
        plan_id: plan.id,
        price: finalPrice,
        status: "pending",
        account_email: accountEmail,
        payment_provider: "pally",
        meta: promo
          ? {
              promo_code: promo.code,
              promo_type: promo.type,
              promo_value: promo.value,
              discount_value: discountValue,
              original_price: plan.price,
            }
          : null,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("[Checkout] Ошибка создания заказа:", orderError);
      return NextResponse.json({ error: "Ошибка создания заказа" }, { status: 500 });
    }

    const { getPublicSiteOrigin } = await import("@/lib/app-url");
    const appUrl = getPublicSiteOrigin();

    let payment: { paymentId: string; paymentUrl: string };
    try {
      payment = await createPallyPayment({
        orderId: order.id,
        amount: finalPrice,
        description: `GPT STORE: ${plan.name}`,
        returnUrl: `${appUrl}/checkout/success?order=${order.id}`,
        webhookUrl: `${appUrl}/api/payments/pally/webhook`,
        customerEmail: user.email ?? undefined,
      });
    } catch (payErr) {
      await notifyOperationalFailure({
        context: "Ошибка создания платежа Pally",
        detail: payErr instanceof Error ? payErr.message : undefined,
      }).catch(() => {});
      throw payErr;
    }

    await supabase
      .from("orders")
      .update({ payment_id: payment.paymentId, pally_order_id: payment.paymentId })
      .eq("id", order.id);

    await notifyNewOrder(
      { id: order.id, plan_name: plan.name, price: finalPrice, account_email: accountEmail },
      { email: user.email ?? null },
    );
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
