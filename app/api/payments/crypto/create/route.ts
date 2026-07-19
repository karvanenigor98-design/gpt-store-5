import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCryptoPayment } from "@/lib/payments/crypto";
import { notifyCustomerOrderCreated, notifyNewOrder } from "@/lib/telegram/notifications";
import { PLUS_PLANS, PRO_PLANS } from "@/lib/chatgpt-data";
import { z } from "zod";
import { applyPromo, getStoreConfig, splitPlans } from "@/lib/store-config";

const schema = z.object({
  planId: z.string(),
  accountEmail: z.string().email(),
  promoCode: z.string().nullable().optional(),
});

// Курс USD/RUB для конвертации (обновлять периодически)
const USD_RATE = Number(process.env.USD_RATE ?? "90");

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { planId, accountEmail } = parsed.data;
  const config = await getStoreConfig();
  const split = splitPlans(config.plans);
  const allPlans = [...(split.plus.length ? split.plus : PLUS_PLANS), ...(split.pro.length ? split.pro : PRO_PLANS)];
  const plan = allPlans.find((p) => p.id === planId);
  if (!plan || plan.price <= 0) {
    return NextResponse.json({ error: "Plan not found" }, { status: 400 });
  }
  if (plan.inStock === false) {
    return NextResponse.json({ error: "Plan is out of stock" }, { status: 400 });
  }

  let promo: import("@/lib/store-config").PromoCode | null = null;
  if (parsed.data.promoCode?.trim()) {
    const { resolvePromoForPlan, promoUserMessage } = await import("@/lib/promocodes/promo-resolve");
    const resolved = resolvePromoForPlan(config.promoCodes, parsed.data.promoCode, plan.id);
    if (!resolved.ok) {
      console.warn("[crypto-checkout] promo rejected:", resolved.technical, {
        planId: plan.id,
        reason: resolved.reason,
      });
      return NextResponse.json({ error: promoUserMessage(resolved.reason) }, { status: 400 });
    }
    promo = resolved.promo;
  }
  const { finalPrice, discountValue } = applyPromo(plan.price, promo);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://subrf.ru";
  const amountUsd = Math.ceil((finalPrice / USD_RATE) * 100) / 100;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      product: plan.productId,
      plan_id: plan.id,
      price: finalPrice,
      currency: "RUB",
      payment_method: "crypto",
      payment_provider: "cryptocloud",
      account_email: accountEmail,
      status: "pending",
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
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  try {
    const payment = await createCryptoPayment({
      orderId: order.id,
      amount: amountUsd,
      description: `GPT STORE — ${plan.name}`,
      returnUrl: `${appUrl}/checkout/success?order=${order.id}`,
    });

    await supabase
      .from("orders")
      .update({ payment_id: payment.invoiceId })
      .eq("id", order.id);

    await notifyNewOrder(order, user).catch(() => {});
    if (user.email) {
      await notifyCustomerOrderCreated({
        customerEmail: user.email,
        orderId: order.id,
        planName: plan.name,
        price: finalPrice,
        accountEmail,
      }).catch(() => {});
    }

    return NextResponse.json({ paymentUrl: payment.paymentUrl, orderId: order.id });
  } catch (err) {
    console.error("CryptoCloud payment create error:", err);
    await supabase.from("orders").update({ status: "failed" }).eq("id", order.id);
    return NextResponse.json({ error: "Payment service unavailable" }, { status: 502 });
  }
}
