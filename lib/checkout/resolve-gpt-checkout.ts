import type { SupabaseClient } from "@supabase/supabase-js";

import { CHATGPT_PLANS, type ExtendedPlan } from "@/lib/chatgpt-data";
import { createGptStoreOrder } from "@/lib/orders/create-gpt-order";
import { promoUserMessage, resolvePromoForPlan } from "@/lib/promocodes/promo-resolve";
import { applyPromo, getStoreConfig, splitPlans, type PromoCode } from "@/lib/store-config";
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
  const allPlans = [
    ...(split.plus.length ? split.plus : CHATGPT_PLANS.plus),
    ...(split.pro.length ? split.pro : CHATGPT_PLANS.pro),
    ...(split.go.length ? split.go : CHATGPT_PLANS.go),
  ];
  const plan = allPlans.find((p) => p.id === planId);

  if (!plan) {
    return { ok: false, error: "Тариф не найден", status: 400 };
  }
  if (plan.inStock === false) {
    return { ok: false, error: "Этот тариф временно отсутствует в наличии", status: 400 };
  }

  let promo: PromoCode | null = null;
  if (promoCode?.trim()) {
    const resolved = resolvePromoForPlan(config.promoCodes, promoCode, plan.id);
    if (!resolved.ok) {
      console.warn("[gpt-checkout] promo rejected:", resolved.technical, {
        planId: plan.id,
        reason: resolved.reason,
      });
      return {
        ok: false,
        error: promoUserMessage(resolved.reason),
        status: 400,
      };
    }
    promo = resolved.promo;
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

/** Неоплаченные — можно обновлять и снова вести на Pally. (awaiting_payment — legacy rows) */
export const GPT_UNPAID_REUSE_STATUSES = ["pending", "awaiting_payment"] as const;

/**
 * Уже оплаченные, но ещё не активированные — не плодим twin при повторном Pay.
 * active/failed/expired/refunded не reuse (новый цикл покупки ок).
 */
export const GPT_OPEN_FULFILLMENT_STATUSES = ["paid", "activating", "waiting_client"] as const;

export const GPT_REUSABLE_STATUSES = [
  ...GPT_UNPAID_REUSE_STATUSES,
  ...GPT_OPEN_FULFILLMENT_STATUSES,
] as const;

const GPT_UNPAID_OR = "status.eq.pending,status.eq.awaiting_payment";
const GPT_REUSABLE_OR =
  "status.eq.pending,status.eq.awaiting_payment,status.eq.paid,status.eq.activating,status.eq.waiting_client";
const GPT_OPEN_OR = "status.eq.paid,status.eq.activating,status.eq.waiting_client";

export function isGptUnpaidReuseStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return s === "pending" || s === "awaiting_payment";
}

export function isGptReusableCheckoutStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return (
    s === "pending" ||
    s === "awaiting_payment" ||
    s === "paid" ||
    s === "activating" ||
    s === "waiting_client"
  );
}

async function findReusableGptOrder(
  admin: Admin,
  input: {
    userId: string;
    planId: string;
    accountEmail?: string | null;
    existingOrderId?: string | null;
  },
): Promise<Database["public"]["Tables"]["orders"]["Row"] | null> {
  const email = input.accountEmail?.trim().toLowerCase() || null;

  if (input.existingOrderId) {
    const { data: byId } = await admin
      .from("orders")
      .select("*")
      .eq("id", input.existingOrderId)
      .eq("user_id", input.userId)
      .or(GPT_REUSABLE_OR)
      .maybeSingle();
    if (byId) return byId;
  }

  // 1) unpaid twin first
  {
    let unpaidQuery = admin
      .from("orders")
      .select("*")
      .eq("user_id", input.userId)
      .eq("plan_id", input.planId)
      .or(GPT_UNPAID_OR)
      .order("created_at", { ascending: false })
      .limit(1);

    if (email) {
      unpaidQuery = unpaidQuery.ilike("account_email", email);
    }

    const { data: unpaid } = await unpaidQuery.maybeSingle();
    if (unpaid) return unpaid;
  }

  // 2) open fulfillment (paid / in progress) — block second order
  {
    let openQuery = admin
      .from("orders")
      .select("*")
      .eq("user_id", input.userId)
      .eq("plan_id", input.planId)
      .or(GPT_OPEN_OR)
      .order("created_at", { ascending: false })
      .limit(1);

    if (email) {
      openQuery = openQuery.ilike("account_email", email);
    }

    const { data: open } = await openQuery.maybeSingle();
    if (open) return open;
  }

  return null;
}

export async function upsertGptPendingOrder(
  admin: Admin,
  input: {
    userId: string;
    accountEmail?: string | null;
    resolved: GptCheckoutResolved;
    existingOrderId?: string | null;
    extraMeta?: Json | null;
    /** Guest Pay: reuse only this unpaid id — never attach to another user's open fulfillment. */
    guestCheckout?: boolean;
  },
): Promise<{
  order: Database["public"]["Tables"]["orders"]["Row"] | null;
  error: string | null;
  created: boolean;
}> {
  const { plan, finalPrice, meta } = input.resolved;
  const email = input.accountEmail?.trim() || null;
  const product = plan.productId ?? "chatgpt-plus";
  const mergedMeta: Json | null = (() => {
    const extra = input.extraMeta;
    if (!meta && !extra) return null;
    return {
      ...(typeof meta === "object" && meta ? meta : {}),
      ...(typeof extra === "object" && extra ? extra : {}),
    } as Json;
  })();

  let existing: Database["public"]["Tables"]["orders"]["Row"] | null = null;
  if (input.guestCheckout) {
    if (input.existingOrderId) {
      const { data: byId } = await admin
        .from("orders")
        .select("*")
        .eq("id", input.existingOrderId)
        .eq("user_id", input.userId)
        .or(GPT_UNPAID_OR)
        .maybeSingle();
      existing = byId;
    }
  } else {
    existing = await findReusableGptOrder(admin, {
      userId: input.userId,
      planId: plan.id,
      accountEmail: email,
      existingOrderId: input.existingOrderId,
    });
  }

  if (existing) {
    // Уже в работе после оплаты — не откатываем в pending и не плодим twin.
    if (!isGptUnpaidReuseStatus(existing.status)) {
      return { order: existing, error: null, created: false };
    }

    const { data: updated, error: updateErr } = await admin
      .from("orders")
      .update({
        product,
        plan_id: plan.id,
        price: finalPrice,
        ...(email ? { account_email: email } : {}),
        meta: mergedMeta,
        payment_provider: "pally",
        status: "pending",
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateErr) {
      return { order: null, error: updateErr.message, created: false };
    }
    return { order: updated, error: null, created: false };
  }

  const { order, error } = await createGptStoreOrder(admin, {
    userId: input.userId,
    product,
    planId: plan.id,
    price: finalPrice,
    accountEmail: email,
    paymentProvider: "pally",
    meta: mergedMeta,
  });

  return { order, error, created: true };
}
