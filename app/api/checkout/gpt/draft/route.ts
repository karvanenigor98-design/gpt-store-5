import { NextRequest, NextResponse } from "next/server";

import { resolveGptCheckoutPlan, upsertGptPendingOrder } from "@/lib/checkout/resolve-gpt-checkout";
import { ensureGptProfile } from "@/lib/orders/create-gpt-order";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { notifyNewOrder } from "@/lib/telegram/notifications";

/** Создаёт или обновляет заказ «ожидает оплаты» после шага email (до Pally). */
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

    const admin = createAdminClient();
    await ensureGptProfile(admin, user);

    const { order, error: orderError, created } = await upsertGptPendingOrder(admin, {
      userId: user.id,
      accountEmail: accountEmail?.trim() || user.email?.trim() || null,
      resolved: resolvedPlan.resolved,
      existingOrderId: orderId,
    });

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError ?? "Ошибка создания заказа" },
        { status: 500 },
      );
    }

    if (created) {
      const { plan, finalPrice } = resolvedPlan.resolved;
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
    }

    return NextResponse.json({ orderId: order.id });
  } catch (err) {
    console.error("[Checkout draft]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Внутренняя ошибка" },
      { status: 500 },
    );
  }
}
