import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveOrderSubscriptionExpiresAt } from "@/lib/admin/admin-subscription-label";
import { formatSubsTariffDisplayLabel } from "@/lib/admin/subs-tariff-display-label";

/** Поля subs.orders для PATCH статуса (без plan_id/plan_name — их нет в Subs DB). */
export const SUBS_ORDER_PATCH_SELECT =
  "id,status,payment_status,user_id,tariff_id,final_price,customer_email,activated_at,expires_at,paid_at";

export async function fetchSubsOrderForStatusPatch(
  subs: SupabaseClient,
  orderId: string,
): Promise<
  | {
      id: string;
      status: string;
      payment_status: string | null;
      user_id: string | null;
      tariff_id: string | null;
      final_price: number | null;
      customer_email: string | null;
      planTitle: string;
      durationMonths: number | null;
      activated_at: string | null;
      expires_at: string | null;
      paid_at: string | null;
    }
  | null
> {
  let { data: order, error } = await subs
    .from("orders")
    .select(SUBS_ORDER_PATCH_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error && /does not exist|column .* does not/i.test(error.message)) {
    ({ data: order, error } = await subs
      .from("orders")
      .select("id,status,payment_status,user_id,tariff_id,final_price,customer_email,paid_at")
      .eq("id", orderId)
      .maybeSingle());
  }

  if (error || !order) return null;

  let planTitle = "Spotify Premium";
  let durationMonths: number | null = null;
  if (order.tariff_id) {
    const { data: tariff } = await subs
      .from("tariffs")
      .select("title,slug,category,duration_months")
      .eq("id", order.tariff_id)
      .maybeSingle();
    if (tariff) {
      planTitle = formatSubsTariffDisplayLabel(tariff);
      durationMonths =
        tariff.duration_months != null ? Number(tariff.duration_months) : null;
    }
  }

  return {
    id: String(order.id),
    status: String(order.status),
    payment_status: order.payment_status as string | null,
    user_id: order.user_id as string | null,
    tariff_id: order.tariff_id as string | null,
    final_price: order.final_price != null ? Number(order.final_price) : null,
    customer_email: (order.customer_email as string | null) ?? null,
    planTitle,
    durationMonths,
    activated_at: (order.activated_at as string | null) ?? null,
    expires_at: (order.expires_at as string | null) ?? null,
    paid_at: (order.paid_at as string | null) ?? null,
  };
}

const SUBS_ACTIVATED_STATUSES = new Set(["activated", "completed"]);

/** При переводе в activated/completed проставляет activated_at и expires_at, если их ещё нет. */
export function buildSubsOrderActivationPatch(
  order: {
    status: string;
    activated_at: string | null;
    expires_at: string | null;
    paid_at: string | null;
    durationMonths: number | null;
  },
  nextStatus: string,
): Record<string, string> {
  if (!SUBS_ACTIVATED_STATUSES.has(nextStatus)) return {};

  const patch: Record<string, string> = {};
  const nowIso = new Date().toISOString();
  const activatedAt = order.activated_at ?? nowIso;

  if (!order.activated_at) {
    patch.activated_at = activatedAt;
  }

  if (!order.expires_at) {
    const expiresAt = resolveOrderSubscriptionExpiresAt({
      activated_at: activatedAt,
      paid_at: order.paid_at,
      durationMonths: order.durationMonths,
    });
    if (expiresAt) patch.expires_at = expiresAt;
  }

  return patch;
}

/** Синхронизация payment_status при ручной смене status в админке. */
export function subsPaymentStatusForOrderStatus(status: string): string | null {
  const s = status.trim().toLowerCase();
  if (["awaiting_payment", "new", "pending_payment_setup"].includes(s)) {
    return "pending";
  }
  if (["paid", "processing", "awaiting_data", "awaiting_operator", "activated", "completed"].includes(s)) {
    return "paid";
  }
  if (["cancelled", "refund"].includes(s)) return "refunded";
  if (["problem", "failed"].includes(s)) return "failed";
  return null;
}
