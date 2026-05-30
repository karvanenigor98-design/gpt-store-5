import type { SiteSlug } from "@/lib/sites";
import { fetchPallyBillStatus, mapPallyStatus } from "@/lib/payments/pally";
import { processPallyWebhook, type PallyWebhookPayload } from "@/lib/payments/process-pally-webhook";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { isPaidLikeStatus } from "@/lib/orders/paid-like-status";

export type ReconcileResult =
  | { ok: true; applied: boolean; reason: string }
  | { ok: false; error: string };

/** Повторно применить оплату, если webhook не дошёл (success page / cron). */
export async function reconcileUnpaidOrderPayment(params: {
  siteSlug: SiteSlug;
  orderId: string;
  /** true — применить paid без проверки Pally (только cron с секретом). */
  forcePaid?: boolean;
}): Promise<ReconcileResult> {
  const { siteSlug, orderId, forcePaid } = params;

  if (siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) return { ok: false, error: "subs_not_configured" };

    const { data: order } = await subs
      .from("orders")
      .select("id,status,payment_status,final_price,payment_external_id,created_at")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return { ok: false, error: "order_not_found" };
    if (isPaidLikeStatus(String(order.status), siteSlug)) {
      return { ok: true, applied: false, reason: "already_paid" };
    }

    if (order.payment_status === "paid") {
      const amount = Number(order.final_price) || 0;
      const body: PallyWebhookPayload = {
        order_id: orderId,
        status: "paid",
        amount,
        site_slug: "subs-store",
        payment_id: order.payment_external_id ?? undefined,
      };
      const result = await processPallyWebhook(body);
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, applied: true, reason: "payment_status_paid_sync" };
    }

    const amount = Number(order.final_price) || 0;
    let pallyStatus: string | null = null;
    if (!forcePaid) {
      pallyStatus = await fetchPallyBillStatus({
        site: "subs-store",
        orderId,
        amount,
      });
      if (!pallyStatus) {
        return { ok: true, applied: false, reason: "pally_status_unknown" };
      }
      if (mapPallyStatus(pallyStatus) !== "paid") {
        return { ok: true, applied: false, reason: `pally_status_${pallyStatus}` };
      }
    }

    const body: PallyWebhookPayload = {
      order_id: orderId,
      status: "paid",
      amount,
      site_slug: "subs-store",
      payment_id: order.payment_external_id ?? undefined,
    };
    const result = await processPallyWebhook(body);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, applied: true, reason: forcePaid ? "forced" : "pally_paid" };
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,status,price,payment_id,pally_order_id,created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return { ok: false, error: "order_not_found" };
  if (isPaidLikeStatus(String(order.status), siteSlug)) {
    return { ok: true, applied: false, reason: "already_paid" };
  }

  const amount = Number(order.price) || 0;
  if (!forcePaid) {
    const pallyStatus = await fetchPallyBillStatus({
      site: "gpt-store",
      orderId,
      amount,
    });
    if (!pallyStatus) {
      return { ok: true, applied: false, reason: "pally_status_unknown" };
    }
    if (mapPallyStatus(pallyStatus) !== "paid") {
      return { ok: true, applied: false, reason: `pally_status_${pallyStatus}` };
    }
  }

  const body: PallyWebhookPayload = {
    order_id: orderId,
    status: "paid",
    amount,
    site_slug: "gpt-store",
    payment_id: order.payment_id ?? order.pally_order_id ?? undefined,
  };
  const result = await processPallyWebhook(body);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, applied: true, reason: forcePaid ? "forced" : "pally_paid" };
}
