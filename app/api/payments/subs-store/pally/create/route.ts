import { NextRequest, NextResponse } from "next/server";

import { buildPallyRedirectUrls, createPallyPayment } from "@/lib/payments/pally";
import { isPallyConfigError } from "@/lib/payments/pally-env-hint";
import { applyPromo, findPromo } from "@/lib/store-config";
import { getSubsStoreConfig } from "@/lib/subs-store-config";
import { createSubsAwaitingPaymentOrder } from "@/lib/subs/create-subs-order";
import { notifySubsStoreStaffOrderEvent } from "@/lib/subs/subs-notifications";
import { scheduleUnpaidOrderReminder } from "@/lib/email/schedule-unpaid-reminder";
import {
  notifyCustomerOrderCreated,
  notifyNewOrder,
  notifyOperationalFailure,
} from "@/lib/telegram/notifications";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Тариф не найден" }, { status: 404 });
    }

    const promoAllowed = plan.allowPromocodes !== false;
    const promo = promoAllowed ? findPromo(config.promoCodes, promoCode, plan.id) : null;
    if (promoCode?.trim() && promoAllowed && !promo) {
      return NextResponse.json({ error: "Промокод недействителен или не подходит к этому тарифу" }, { status: 400 });
    }

    const { finalPrice, discountValue } = applyPromo(plan.price, promo);
    const customerEmail = accountEmail.trim().toLowerCase();

    let subsUserId: string | null = null;
    let sessionEmail: string | null = null;
    const subsAuth = await createSubsAuthServerClient();
    if (subsAuth) {
      const {
        data: { user },
      } = await subsAuth.auth.getUser();
      if (user) {
        subsUserId = user.id;
        sessionEmail = user.email ?? null;
      }
    }

    const created = await createSubsAwaitingPaymentOrder({
      tariffSlug: plan.id,
      customerEmail,
      basePrice: plan.price,
      finalPrice,
      discountAmount: discountValue,
      promocodeCode: promo?.code ?? null,
      promocodeId: promo?.dbId ?? null,
      userId: subsUserId,
      paymentProvider: "pally",
    });

    if (!created.ok) {
      console.error("[Subs checkout]", created.error);
      return NextResponse.json({ error: created.error }, { status: 500 });
    }

    const orderId = created.orderId;
    const { getPublicSiteOrigin } = await import("@/lib/app-url");
    const appUrl = getPublicSiteOrigin();
    const { successUrl, failUrl } = buildPallyRedirectUrls(appUrl, "subs-store");

    let payment: { paymentId: string; paymentUrl: string };
    try {
      payment = await createPallyPayment({
        orderId,
        amount: finalPrice,
        description: `SPOTIFY STORE: ${plan.name}`,
        successUrl,
        failUrl,
        webhookUrl: `${appUrl}/api/payments/pally/webhook`,
        customerEmail: sessionEmail ?? customerEmail,
        site: "subs-store",
      });
    } catch (payErr) {
      const detail = payErr instanceof Error ? payErr.message : undefined;
      await notifyOperationalFailure({
        context: "Subs Store: ошибка Pally",
        detail,
      }).catch(() => {});

      const userMessage =
        detail && isPallyConfigError(detail)
          ? "Оплата временно недоступна. Заказ сохранён, оператор свяжется с вами."
          : detail ?? "Не удалось создать ссылку на оплату. Заказ сохранён, попробуйте позже.";

      return NextResponse.json(
        {
          error: userMessage,
          orderId,
          orderSaved: true,
        },
        { status: 503 },
      );
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
      title: "SPOTIFY STORE: новый заказ ожидает оплаты",
      message: msg,
      orderId,
      emailSubject: "🔔 Новый заказ ожидает оплаты — SPOTIFY STORE",
      emailBody: `Новый заказ SPOTIFY STORE\nТариф: ${planLabel}\nСумма: ${finalPrice} ₽\nEmail: ${customerEmail}\n\nАдминка: ${appUrl}/admin/orders?site=subs-store&status=awaiting_payment&highlight=${orderId}`,
    });

    await notifyNewOrder(
      { id: orderId, plan_name: planLabel, price: finalPrice, account_email: customerEmail, product: "spotify-premium" },
      { email: sessionEmail ?? customerEmail },
      { siteSlug: "subs-store" },
    );

    await notifyCustomerOrderCreated({
      customerEmail,
      orderId,
      planName: planLabel,
      price: finalPrice,
      accountEmail: customerEmail,
      siteSlug: "subs-store",
      customerUserId: subsUserId,
    }).catch(() => {});

    await scheduleUnpaidOrderReminder({
      siteSlug: "subs-store",
      orderId,
      recipientEmail: customerEmail,
      planName: planLabel,
      price: finalPrice,
    }).catch(() => {});

    return NextResponse.json({ paymentUrl: payment.paymentUrl, orderId });
  } catch (err) {
    console.error("[Subs checkout]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Внутренняя ошибка" },
      { status: 500 },
    );
  }
}
