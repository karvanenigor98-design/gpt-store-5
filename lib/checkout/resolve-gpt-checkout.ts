import type { SupabaseClient } from "@supabase/supabase-js";

import { CHATGPT_PLANS, type ExtendedPlan } from "@/lib/chatgpt-data";
import { createGptStoreOrder } from "@/lib/orders/create-gpt-order";
import { applyPromo, findPromo, getStoreConfig, splitPlans } from "@/lib/store-config";
import type { Database, Json } from "@/types/database";

export type GptCheckoutResolved = {
  plan: ExtendedPlan;
  finalPrice: number;
  discountValue: number;
  meta: Json | null;
};

export async function resolveGptCheckoutPlan(
  planId: string,
  promoCode?: string | null,
): Promise<
  | { ok: true; resolved: GptCheckoutResolved }
  | { ok: false; error: string; status: number }
> {
  const config = await getStoreConfig();
  const split = splitPlans(config.plans);
  const allPlans = [...(split.plus ?? CHATGPT_PLANS.plus), ...(split.pro ?? CHATGPT_PLANS.pro)];
  const plan = allPlans.find((p) => p.id === planId);

  if (!plan) {
    return { ok: false, error: "Тариф не найден", status: 400 };
  }
  if (plan.inStock === false) {
    return { ok: false, error: "Этот тариф временно отсутствует в наличии", status: 400 };
  }

  const promo = findPromo(config.promoCodes, promoCode, plan.id);
  if (promoCode?.trim() && !promo) {
    return {
      ok: false,
      error: "Промокод недействителен или не подходит к этому тарифу",
      status: 400,
    };
  }

  const { finalPrice, discountValue } = applyPromo(plan.price, promo);

  const meta: Json | null = promo
    ? {
        promo_code: promo.code,
        promo_type: promo.type,
        promo_value: promo.value,
        discount_value: discountValue,
        original_price: plan.price,
      }
    : null;

  return {
    ok: true,
    resolved: { plan, finalPrice, discountValue, meta },
  };
}

type Admin = SupabaseClient<Database>;

export async function upsertGptPendingOrder(
  admin: Admin,
  input: {
    userId: string;
    accountEmail: string;
    resolved: GptCheckoutResolved;
    existingOrderId?: string | null;
  },
): Promise<{
  order: Database["public"]["Tables"]["orders"]["Row"] | null;
  error: string | null;
  created: boolean;
}> {
  const { plan, finalPrice, meta } = input.resolved;
  const email = input.accountEmail.trim();
  const product = plan.productId ?? "chatgpt-plus";

  if (input.existingOrderId) {
    const { data: existing, error: fetchErr } = await admin
      .from("orders")
      .select("*")
      .eq("id", input.existingOrderId)
      .eq("user_id", input.userId)
      .eq("status", "pending")
      .maybeSingle();

    if (!fetchErr && existing) {
      const { data: updated, error: updateErr } = await admin
        .from("orders")
        .update({
          product,
          plan_id: plan.id,
          price: finalPrice,
          account_email: email,
          meta,
          payment_provider: "pally",
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) {
        return { order: null, error: updateErr.message, created: false };
      }
      return { order: updated, error: null, created: false };
    }
  }

  const { order, error } = await createGptStoreOrder(admin, {
    userId: input.userId,
    product,
    planId: plan.id,
    price: finalPrice,
    accountEmail: email,
    paymentProvider: "pally",
    meta,
  });

  return { order, error, created: true };
}
