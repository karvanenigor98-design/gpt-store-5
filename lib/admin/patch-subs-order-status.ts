import type { SupabaseClient } from "@supabase/supabase-js";

/** Поля subs.orders для PATCH статуса (без plan_id/plan_name — их нет в Subs DB). */
export const SUBS_ORDER_PATCH_SELECT =
  "id,status,payment_status,user_id,tariff_id,final_price,customer_email";

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
    }
  | null
> {
  const { data: order, error } = await subs
    .from("orders")
    .select(SUBS_ORDER_PATCH_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) return null;

  let planTitle = "Spotify Premium";
  if (order.tariff_id) {
    const { data: tariff } = await subs
      .from("tariffs")
      .select("title")
      .eq("id", order.tariff_id)
      .maybeSingle();
    if (tariff?.title) planTitle = tariff.title;
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
  };
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
