import { NextRequest, NextResponse } from "next/server";

import { createPallyPayment } from "@/lib/payments/pally";
import { applyPromo, findPromo } from "@/lib/store-config";
import { getSubsStoreConfig } from "@/lib/subs-store-config";
import { createSubsAwaitingPaymentOrder } from "@/lib/subs/create-subs-order";
import { notifySubsStoreStaffOrderEvent } from "@/lib/subs/subs-notifications";
import {
  notifyCustomerOrderCreated,
  notifyNewOrder,
  notifyOperationalFailure,
} from "@/lib/telegram/notifications";
import { createClient } from "@/lib/supabase/server";

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
    };

    const { planId, accountEmail, promoCode } = body;
    if (!planId || !accountEmail?.trim()) {
      return NextResponse.json({ error: "Укажите тариф и email" }, { status: 400 });
    }

    const config = await getSubsStoreConfig();
    const plan = config.plans.find((p) => p.id === planId);
    if (!plan) {
      return NextResponse.json({ error: "Тариф не найден" }, { status: 400 });
    }

    const promoAllowed = plan.allowPromocodes !== false;
    const promo = promoAllowed ? findPromo(config.promoCodes, promoCode, plan.id) : null;
    if (promoCode?.trim() && promoAllowed && !promo) {
      return NextResponse.json({ error: "Промокод недействителен или не подходит к этому тарифу" }, { status: 400 });
    }

    const { finalPrice, discountValue } = applyPromo(plan.price, promo);
    const customerEmail = accountEmail.trim();

    const created = await createSubsAwaitingPaymentOrder({
      tariffSlug: plan.id,
      customerEmail,
      basePrice: plan.price,
      finalPrice,
      discountAmount: discountValue,
      promocodeCode: promo?.code ?? null,
      promocodeId: promo?.dbId ?? null,
      paymentProvider: "pally",
    });

    if (!created.ok) {
      console.error("[Subs checkout]", created.error);
      return NextResponse.json({ error: created.error }, { status: 500 });
    }

    const orderId = created.orderId;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3056";

    let payment: { paymentId: string; paymentUrl: string };
    try {
      payment = await createPallyPayment({
        orderId,
        amount: finalPrice,
        description: `Subs Store: ${plan.name}`,
        returnUrl: `${appUrl}/checkout/success?order=${orderId}`,
        webhookUrl: `${appUrl}/api/payments/pally/webhook`,
        customerEmail: user.email ?? customerEmail,
      });
    } catch (payErr) {
      await notifyOperationalFailure({
        context: "Subs Store: ошибка Pally",
        detail: payErr instanceof Error ? payErr.message : undefined,
      }).catch(() => {});
      throw payErr;
    }

    const subs = (await import("@/lib/supabase/subs-store-admin")).createSubsStoreAdminClient();
    if (subs) {
      await subs
        .from("orders")
        .update({ payment_external_id: payment.paymentId })
        .eq("id", orderId);
    }

    const planLabel = plan.name;
    const msg = `${planLabel} · ${finalPrice} ₽ · ${customerEmail}`;

    await notifySubsStoreStaffOrderEvent({
      type: "new_order",
      title: "Subs Store: новый заказ Spotify",
      message: msg,
      orderId,
      emailSubject: "🔔 Новый заказ Spotify — Subs Store",
      emailBody: `Новый заказ Subs Store\nТариф: ${planLabel}\nСумма: ${finalPrice} ₽\nEmail: ${customerEmail}\n\nАдминка: ${appUrl}/admin/orders?site=subs-store&status=awaiting_payment&highlight=${orderId}`,
    });

    await notifyNewOrder(
      { id: orderId, plan_name: planLabel, price: finalPrice, account_email: customerEmail, product: "spotify-premium" },
      { email: user.email ?? null },
      { siteSlug: "subs-store" },
    );

    if (user.email) {
      await notifyCustomerOrderCreated({
        customerEmail: user.email,
        orderId,
        planName: planLabel,
        price: finalPrice,
        accountEmail: customerEmail,
        siteSlug: "subs-store",
        customerUserId: user.id,
      }).catch(() => {});
    }

    return NextResponse.json({ paymentUrl: payment.paymentUrl, orderId });
  } catch (err) {
    console.error("[Subs checkout]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Внутренняя ошибка" },
      { status: 500 },
    );
  }
}
