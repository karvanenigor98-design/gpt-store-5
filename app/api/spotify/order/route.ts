import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3056";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      planId: string;
      planName: string;
      price: number;
      email: string;
    };

    const { planId, planName, price, email } = body;

    if (!planId || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { createSubsAwaitingPaymentOrder } = await import("@/lib/subs/create-subs-order");
    const { notifySubsStoreStaffOrderEvent } = await import("@/lib/subs/subs-notifications");

    const created = await createSubsAwaitingPaymentOrder({
      tariffSlug: planId,
      customerEmail: email,
      finalPrice: price,
      basePrice: price,
      paymentProvider: "manual",
    });

    const orderId = created.ok ? created.orderId : undefined;
    const adminOrdersUrl = orderId
      ? `${APP_URL}/admin/orders?site=subs-store&status=awaiting_payment&highlight=${orderId}`
      : `${APP_URL}/admin/orders?site=subs-store&status=awaiting_payment`;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

    if (token && chatId && chatId !== "0") {
      const text =
        `🎵 *Новый заказ Spotify Premium*\n\n` +
        `📦 Тариф: ${planName}\n` +
        `💰 Сумма: ${price.toLocaleString("ru")} ₽\n` +
        `📧 Email: ${email}\n` +
        `🆔 ID тарифа: ${planId}`;

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      }).catch(() => {});
    }

    if (created.ok) {
      await notifySubsStoreStaffOrderEvent({
        type: "new_order",
        title: "Subs Store: новый заказ Spotify",
        message: `${planName} · ${price} ₽ · ${email}`,
        orderId: created.orderId,
        emailSubject: "🔔 Новый заказ Spotify — Subs Store",
        emailBody: `Новый заказ Subs Store\nТариф: ${planName}\nСумма: ${price} ₽\nEmail: ${email}\nОткрыть: ${adminOrdersUrl}`,
      });
    }

    const { recordGptStaffEvent } = await import("@/lib/notifications/staff-events");
    void recordGptStaffEvent({
      type: "new_order",
      title: "Subs Store: новый заказ Spotify",
      message: `${planName} · ${price} ₽ · ${email}`,
      siteSlug: "subs-store",
      entity_type: orderId ? "order" : null,
      entity_id: orderId ?? null,
      emailSubject: "🔔 Новый заказ Spotify — Subs Store",
      emailBody: `Новый заказ Subs Store\nТариф: ${planName}\nСумма: ${price} ₽\nEmail: ${email}\nОткрыть: ${adminOrdersUrl}`,
    }).catch(() => undefined);

    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, orderId: created.orderId });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
