/**
 * Создание заказа в БД Subs Store (ожидает оплаты) из GPT STORE checkout.
 */

import type { SubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export type CreateSubsAwaitingPaymentOrderParams = {
  tariffSlug: string;
  customerEmail: string;
  finalPrice: number;
  basePrice?: number;
  discountAmount?: number;
  promocodeDiscount?: number;
  promocodeId?: string | null;
  promocodeCode?: string | null;
  appliedDiscountId?: string | null;
  userId?: string | null;
  paymentProvider?: string | null;
};

export type CreateSubsAwaitingPaymentOrderResult =
  | { ok: true; orderId: string; tariffTitle: string }
  | { ok: false; error: string };

export async function resolveSubsUserIdByEmail(
  subs: SubsStoreAdminClient,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data: profile } = await subs
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  if (profile?.id) return profile.id;

  let page = 1;
  while (page <= 50) {
    const { data, error } = await subs.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) break;
    const match = data.users.find((u) => (u.email ?? "").trim().toLowerCase() === normalized);
    if (match?.id) return match.id;
    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

const SUBS_UNPAID_STATUSES = ["awaiting_payment", "pending", "new"] as const;

export async function findReusableSubsAwaitingOrder(
  subs: SubsStoreAdminClient,
  input: {
    tariffId: string;
    customerEmail: string;
    userId?: string | null;
    existingOrderId?: string | null;
  },
): Promise<{ id: string; tariff_id: string | null } | null> {
  const email = input.customerEmail.trim().toLowerCase();
  if (!email) return null;

  if (input.existingOrderId) {
    const { data: byId } = await subs
      .from("orders")
      .select("id,tariff_id")
      .eq("id", input.existingOrderId)
      .in("status", [...SUBS_UNPAID_STATUSES])
      .maybeSingle();
    if (byId?.id) return byId;
  }

  let query = subs
    .from("orders")
    .select("id,tariff_id")
    .eq("tariff_id", input.tariffId)
    .ilike("customer_email", email)
    .in("status", [...SUBS_UNPAID_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1);

  if (input.userId) {
    query = query.or(`user_id.eq.${input.userId},user_id.is.null`) as typeof query;
  }

  const { data: byMatch } = await query.maybeSingle();
  return byMatch?.id ? byMatch : null;
}

export async function createSubsAwaitingPaymentOrder(
  params: CreateSubsAwaitingPaymentOrderParams & { existingOrderId?: string | null },
): Promise<CreateSubsAwaitingPaymentOrderResult> {
  const subs = createSubsStoreAdminClient();
  if (!subs) {
    return { ok: false, error: "Subs Store Supabase не настроен (SUBS_SUPABASE_URL / SERVICE_ROLE)." };
  }

  const slug = params.tariffSlug.trim();
  if (!slug) return { ok: false, error: "Не указан тариф." };

  const { data: tariff, error: tariffErr } = await subs
    .from("tariffs")
    .select("id,title,price")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (tariffErr || !tariff) {
    return { ok: false, error: "Тариф не найден в Subs Store." };
  }

  const email = params.customerEmail.trim().toLowerCase();
  if (!email) return { ok: false, error: "Укажите email." };

  const basePrice = params.basePrice ?? Number(tariff.price);
  const finalPrice = params.finalPrice;
  let userId = params.userId ?? null;
  if (!userId) {
    userId = await resolveSubsUserIdByEmail(subs, email);
  }

  const reusable = await findReusableSubsAwaitingOrder(subs, {
    tariffId: tariff.id,
    customerEmail: email,
    userId,
    existingOrderId: params.existingOrderId,
  });

  if (reusable?.id) {
    const { error: updateErr } = await subs
      .from("orders")
      .update({
        user_id: userId,
        status: "awaiting_payment",
        payment_status: "pending",
        base_price: basePrice,
        final_price: finalPrice,
        discount_amount: params.discountAmount ?? Math.max(0, basePrice - finalPrice),
        promocode_discount: params.promocodeDiscount ?? 0,
        promocode_id: params.promocodeId ?? null,
        promocode_code: params.promocodeCode ?? null,
        applied_discount_id: params.appliedDiscountId ?? null,
        customer_email: email,
        payment_provider: params.paymentProvider ?? "pally",
      })
      .eq("id", reusable.id);

    if (updateErr) {
      console.error("[create-subs-order] reuse update:", updateErr.message);
      return { ok: false, error: "Не удалось обновить заказ в Subs Store." };
    }

    return { ok: true, orderId: reusable.id, tariffTitle: tariff.title };
  }

  const { data: order, error: insertErr } = await subs
    .from("orders")
    .insert({
      user_id: userId,
      tariff_id: tariff.id,
      status: "awaiting_payment",
      payment_status: "pending",
      base_price: basePrice,
      final_price: finalPrice,
      discount_amount: params.discountAmount ?? Math.max(0, basePrice - finalPrice),
      promocode_discount: params.promocodeDiscount ?? 0,
      promocode_id: params.promocodeId ?? null,
      promocode_code: params.promocodeCode ?? null,
      applied_discount_id: params.appliedDiscountId ?? null,
      customer_email: email,
      activation_data_status: "not_requested",
      payment_provider: params.paymentProvider ?? "pally",
    })
    .select("id")
    .single();

  if (insertErr || !order?.id) {
    console.error("[create-subs-order] insert:", insertErr?.message);
    return { ok: false, error: "Не удалось создать заказ в Subs Store." };
  }

  return { ok: true, orderId: order.id, tariffTitle: tariff.title };
}
