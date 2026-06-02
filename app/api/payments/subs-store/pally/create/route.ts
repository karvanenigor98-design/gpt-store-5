import { NextRequest, NextResponse } from "next/server";

import { appendCheckoutReturnCookie } from "@/lib/payments/checkout-return-cookie";
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
import { insertSubsStoreNotification } from "@/lib/subs/subs-notifications";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      planId?: string;
      accountEmail?: string;
      promoCode?: string | null;
      orderId?: string | null;
    };

    const { planId, accountEmail, promoCode, orderId: resumeOrderId } = body;

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

    const subsAdmin = (await import("@/lib/supabase/subs-store-admin")).createSubsStoreAdminClient();

    let orderId: string;
    let finalPrice: number;
    let planLabel: string;
    let customerEmail: string;
    let createdNew = false;

    if (resumeOrderId?.trim() && subsAdmin) {
      if (!subsUserId) {
        return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
      }

      const { data: existing } = await subsAdmin
        .from("orders")
        .select("id,status,customer_email,final_price,user_id,tariff_id")
        .eq("id", resumeOrderId.trim())
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
      }

      const st = String(existing.status ?? "");
      if (st !== "awaiting_payment" && st !== "pending") {
        return NextResponse.json({ error: "Заказ уже оплачен или закрыт" }, { status: 400 });
      }

      if (subsUserId && existing.user_id && existing.user_id !== subsUserId) {
        return NextResponse.json({ error: "Заказ принадлежит другому аккаунту" }, { status: 403 });
      }

      const emailNorm = (accountEmail ?? existing.customer_email ?? sessionEmail ?? "").trim().toLowerCase();
      if (
        existing.customer_email &&
        emailNorm &&
        existing.customer_email.toLowerCase() !== emailNorm
      ) {
        return NextResponse.json({ error: "Email не совпадает с заказом" }, { status: 400 });
      }

      customerEmail = existing.customer_email?.trim().toLowerCase() ?? emailNorm;
      if (!customerEmail) {
        return NextResponse.json({ error: "Укажите email" }, { status: 400 });
      }

      finalPrice = Number(existing.final_price ?? 0);
      orderId = existing.id;

      const { data: tariff } = await subsAdmin
        .from("tariffs")
        .select("title,slug")
        .eq("id", existing.tariff_id ?? "")
        .maybeSingle();
      planLabel = tariff?.title ?? "Spotify Premium";
    } else {
      if (!subsUserId) {
        return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
      }

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
        return NextResponse.json(
          { error: "Промокод недействителен или не подходит к этому тарифу" },
          { status: 400 },
        );
      }

      const priced = applyPromo(plan.price, promo);
      customerEmail = accountEmail.trim().toLowerCase();

      const created = await createSubsAwaitingPaymentOrder({
        tariffSlug: plan.id,
        customerEmail,
        basePrice: plan.price,
        finalPrice: priced.finalPrice,
        discountAmount: priced.discountValue,
        promocodeCode: promo?.code ?? null,
        promocodeId: promo?.dbId ?? null,
        userId: subsUserId,
        paymentProvider: "pally",
      });

      if (!created.ok) {
        console.error("[Subs checkout]", created.error);
        return NextResponse.json({ error: created.error }, { status: 500 });
      }

      orderId = created.orderId;
      finalPrice = priced.finalPrice;
      planLabel = created.tariffTitle;
      createdNew = true;
    }

    if (subsUserId && subsAdmin) {
      await subsAdmin
        .from("orders")
        .update({ user_id: subsUserId })
        .eq("id", orderId)
        .or(`user_id.is.null,user_id.neq.${subsUserId}`);
    }

    const { getServerSiteOrigin } = await import("@/lib/app-url");
    const appUrl = getServerSiteOrigin();
    const { successUrl, failUrl } = buildPallyRedirectUrls(appUrl, "subs-store");

    let payment: { paymentId: string; paymentUrl: string };
    try {
      payment = await createPallyPayment({
        orderId,
        amount: finalPrice,
        description: `SPOTIFY STORE: ${planLabel}`,
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

      return appendCheckoutReturnCookie(
        NextResponse.json(
          {
            error: userMessage,
            orderId,
            orderSaved: true,
          },
          { status: 503 },
        ),
        "subs-store",
        orderId,
      );
    }

    if (subsAdmin) {
      await subsAdmin
        .from("orders")
        .update({ payment_external_id: payment.paymentId })
        .eq("id", orderId);
    }

    const msg = `${planLabel} · ${finalPrice} ₽ · ${customerEmail}`;

    if (createdNew && subsUserId) {
      await insertSubsStoreNotification({
        recipientUserId: subsUserId,
        type: "new_order",
        title: "Заказ создан",
        message: `${planLabel} · ${finalPrice} ₽`,
        entity_type: "order",
        entity_id: orderId,
      }).catch(() => ({ ok: false as const, reason: "insert_failed" }));
    }

    if (createdNew) {
      await notifySubsStoreStaffOrderEvent({
        type: "new_order",
        title: "SPOTIFY STORE: новый заказ ожидает оплаты",
        message: msg,
        orderId,
        emailSubject: "🔔 Новый заказ ожидает оплаты — SPOTIFY STORE",
        emailBody: `Новый заказ SPOTIFY STORE\nТариф: ${planLabel}\nСумма: ${finalPrice} ₽\nEmail: ${customerEmail}\n\nАдминка: ${appUrl}/admin/orders?site=subs-store&status=awaiting_payment&highlight=${orderId}`,
      });

      await notifyNewOrder(
        {
          id: orderId,
          plan_name: planLabel,
          price: finalPrice,
          account_email: customerEmail,
          product: "spotify-premium",
        },
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
    }

    const response = NextResponse.json({ paymentUrl: payment.paymentUrl, orderId });
    return appendCheckoutReturnCookie(response, "subs-store", orderId);
  } catch (err) {
    console.error("[Subs checkout]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Внутренняя ошибка" },
      { status: 500 },
    );
  }
}
