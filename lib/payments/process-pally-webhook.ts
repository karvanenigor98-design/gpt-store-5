import { incrementSubsPromocodeUsage } from "@/lib/admin/subs-discount-db";
import { incrementPromocodeUsage } from "@/lib/promocodes/db-promo";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { createAdminClient } from "@/lib/supabase/server";
import { mapPallyStatus } from "@/lib/payments/pally";
import {
  handleOrderPaidNotification,
  isTransitionToPaidLike,
} from "@/lib/notifications/order-paid";
import {
  resolveGptOrderCustomerEmail,
  resolveSubsOrderCustomerEmail,
} from "@/lib/email/resolve-order-customer-email";
import { notifyCustomerOrderStatus, notifyPaymentStatus } from "@/lib/telegram/notifications";
import type { OrderStatus } from "@/types/database";
import type { SiteSlug } from "@/lib/sites";

export type PallyWebhookPayload = Record<string, unknown>;
type PaymentEventRecordResult = "inserted" | "duplicate" | "error";

const GPT_FULFILLMENT_STATUSES = new Set(["activating", "waiting_client", "active"]);
const SUBS_FULFILLMENT_STATUSES = new Set([
  "processing",
  "awaiting_data",
  "activated",
  "completed",
  "problem",
  "refund",
  "awaiting_operator",
]);

const GPT_TERMINAL_STATUSES = new Set<OrderStatus>([
  "failed",
  "refunded",
  "expired",
]);

function resolveGptOrderStatus(
  previous: OrderStatus,
  incoming: OrderStatus,
): OrderStatus {
  if (GPT_FULFILLMENT_STATUSES.has(previous) || previous === "refunded") return previous;
  if (previous === "paid" && incoming !== "refunded") return previous;
  // Terminal statuses cannot be resurrected to paid/pending by webhook alone.
  if (GPT_TERMINAL_STATUSES.has(previous) && incoming !== "refunded") return previous;
  return incoming;
}

function resolveSubsOrderStatus(previous: string, incomingPaymentStatus: string): string {
  if (SUBS_FULFILLMENT_STATUSES.has(previous)) return previous;
  if (previous === "paid" && incomingPaymentStatus !== "refunded") return previous;
  // Cancelled/refund/completed stay terminal unless explicit reconciliation.
  if (
    (previous === "cancelled" || previous === "refund" || previous === "completed") &&
    incomingPaymentStatus === "paid"
  ) {
    return previous;
  }
  if (previous === "cancelled" && incomingPaymentStatus !== "paid") return previous;
  if (incomingPaymentStatus === "paid") return "paid";
  if (incomingPaymentStatus === "failed") return "cancelled";
  return previous;
}

function resolveSubsPaymentStatus(previous: string, incoming: string): string {
  if (previous === "refunded") return previous;
  if (previous === "paid" && incoming !== "refunded") return previous;
  if (incoming === "paid" || incoming === "failed" || incoming === "refunded") return incoming;
  return previous;
}

function paymentIdFromBody(body: PallyWebhookPayload): string | null {
  const raw = body.payment_id ?? body.id ?? body.transaction_id;
  return raw != null ? String(raw) : null;
}

async function recordPaymentEvent(params: {
  siteSlug: SiteSlug;
  orderId: string;
  eventType: string;
  status: string;
  paymentId: string | null;
  idempotencyKey: string;
  rawPayload: PallyWebhookPayload;
}): Promise<PaymentEventRecordResult> {
  try {
    const admin = createAdminClient() as unknown as {
      from: (table: string) => {
        insert: (
          row: Record<string, unknown>,
        ) => Promise<{ error: { code?: string; message?: string } | null }>;
      };
    };
    const { error } = await admin.from("payment_events").insert({
      site_slug: params.siteSlug,
      order_id: params.orderId,
      provider: "pally",
      provider_event_id: params.paymentId,
      payment_id: params.paymentId,
      event_type: params.eventType,
      status: params.status,
      idempotency_key: params.idempotencyKey,
      raw_payload: params.rawPayload,
      processed_at: new Date().toISOString(),
    });
    if (error?.code === "23505") return "duplicate";
    if (error) {
      console.warn("[Pally webhook] payment_events:", error.message);
      return "error";
    }
    return "inserted";
  } catch {
    return "error";
  }
}

async function releasePaymentEvent(idempotencyKey: string): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("payment_events").delete().eq("idempotency_key", idempotencyKey);
  } catch {
    // The provider will retry after the non-2xx webhook response.
  }
}

async function hasRecordedPaymentStatus(params: {
  siteSlug: SiteSlug;
  orderId: string;
  paymentId: string | null;
  status: string;
}): Promise<boolean> {
  try {
    let query = createAdminClient()
      .from("payment_events")
      .select("id")
      .eq("site_slug", params.siteSlug)
      .eq("order_id", params.orderId)
      .eq("provider", "pally")
      .eq("status", params.status);
    query = params.paymentId
      ? query.eq("payment_id", params.paymentId)
      : query.is("payment_id", null);
    const { data, error } = await query.limit(1).maybeSingle();
    return !error && Boolean((data as { id?: string } | null)?.id);
  } catch {
    return false;
  }
}

async function processGptOrder(
  orderId: string,
  internalStatus: string,
  body: PallyWebhookPayload,
  paymentId: string | null,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const supabase = createAdminClient();
  const { data: order, error: findError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (findError || !order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  const siteSlug: SiteSlug = "gpt-store";
  const prevStatus = order.status;
  const mappedStatus: OrderStatus =
    internalStatus === "paid" ? "paid" : (internalStatus as OrderStatus);
  const newStatus = resolveGptOrderStatus(prevStatus, mappedStatus);

  const idempotencyKey = `pally:${orderId}:${paymentId ?? "no-payment-id"}:${pallyStatusKey(body)}`;
  if (
    await hasRecordedPaymentStatus({
      siteSlug,
      orderId,
      paymentId,
      status: internalStatus,
    })
  ) {
    return { ok: true };
  }
  const eventRecord = await recordPaymentEvent({
    siteSlug,
    orderId,
    eventType: "webhook",
    status: internalStatus,
    paymentId,
    idempotencyKey,
    rawPayload: body,
  });
  if (eventRecord === "duplicate") return { ok: true };
  if (eventRecord === "error") {
    return { ok: false, status: 500, error: "Payment event audit failed" };
  }

  const paymentConfirmedNow = internalStatus === "paid" && !order.paid_at;
  const becamePaidLike =
    isTransitionToPaidLike(prevStatus, newStatus, siteSlug) || paymentConfirmedNow;
  const paidAtIso = paymentConfirmedNow ? new Date().toISOString() : undefined;

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({
      status: newStatus,
      ...(paymentId ? { payment_id: paymentId, pally_order_id: paymentId } : {}),
      ...(paidAtIso ? { paid_at: paidAtIso } : {}),
    })
    .eq("id", orderId)
    .eq("status", prevStatus)
    .select("id");

  if (updateError || !updated?.length) {
    await releasePaymentEvent(idempotencyKey);
    console.error(
      "[Pally webhook] GPT order update failed:",
      updateError?.message ?? "concurrent status change",
      orderId,
    );
    return { ok: false, status: 500, error: "Order update failed" };
  }

  if (becamePaidLike && order.user_id) {
    const { processReferralRewardOnFirstPaidOrder } = await import("@/lib/referrals/db");
    void processReferralRewardOnFirstPaidOrder({
      siteSlug,
      referredUserId: order.user_id,
      orderId: order.id,
    }).catch(() => undefined);
  }

  if (becamePaidLike) {
    const meta = order.meta as Record<string, unknown> | null;
    const promoCode = typeof meta?.promo_code === "string" ? meta.promo_code : null;
    await incrementPromocodeUsage(supabase, promoCode).catch(() => undefined);
    if (promoCode?.trim()) {
      const { emailStaffPromocodeUsed } = await import("@/lib/email/notify-hooks");
      void emailStaffPromocodeUsed({
        siteSlug,
        code: promoCode.trim(),
        orderId: order.id,
      }).catch(() => undefined);
    }
  }

  const planTitle = (order as { plan_name?: string | null }).plan_name?.trim() || order.plan_id;

  const customerEmail = await resolveGptOrderCustomerEmail({
    supabase,
    userId: order.user_id,
    accountEmail: order.account_email,
  });

  if (becamePaidLike) {
    void handleOrderPaidNotification({
      orderId: order.id,
      siteSlug,
      planName: planTitle,
      price: order.price,
      status: internalStatus === "paid" ? "paid" : newStatus,
      customerEmail,
      customerUserId: order.user_id,
      accountEmail: order.account_email ?? undefined,
      paidAt: new Date().toISOString(),
    }).catch(() => undefined);

    void notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price: order.price,
        account_email: order.account_email ?? undefined,
      },
      internalStatus === "paid" ? "paid" : newStatus,
      { siteSlug, skipStaffInAppAndEmail: true },
    ).catch(() => undefined);

    if (order.user_id) {
      void import("@/lib/notifications/gpt-customer-notifications")
        .then(({ notifyGptCustomerOrderStatus }) =>
          notifyGptCustomerOrderStatus({
            orderId: order.id,
            customerUserId: order.user_id!,
            status: newStatus,
            planLabel: planTitle,
          }),
        )
        .catch(() => undefined);
    }
  } else if (!becamePaidLike) {
    void notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price: order.price,
        account_email: order.account_email ?? undefined,
      },
      internalStatus === "paid" ? "paid" : newStatus,
      { siteSlug },
    ).catch(() => undefined);
    if (customerEmail) {
      void notifyCustomerOrderStatus({
        customerEmail,
        customerUserId: order.user_id,
        orderId: order.id,
        planName: planTitle,
        status: newStatus,
        price: order.price,
        siteSlug,
      }).catch(() => {});
    }
  }

  return { ok: true };
}

async function processSubsOrder(
  orderId: string,
  internalStatus: string,
  body: PallyWebhookPayload,
  paymentId: string | null,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const subs = createSubsStoreAdminClient();
  if (!subs) {
    return { ok: false, status: 503, error: "Subs Store not configured" };
  }

  const { data: order, error: findError } = await subs
    .from("orders")
    .select("id,status,payment_status,paid_at,final_price,customer_email,user_id,tariff_id,promocode_code")
    .eq("id", orderId)
    .maybeSingle();

  if (findError || !order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  const siteSlug: SiteSlug = "subs-store";
  const prevStatus = String(order.status);
  const newStatus = resolveSubsOrderStatus(prevStatus, internalStatus);
  const newPaymentStatus = resolveSubsPaymentStatus(
    String(order.payment_status),
    internalStatus,
  );

  const idempotencyKey = `pally:subs:${orderId}:${paymentId ?? "no-payment-id"}:${pallyStatusKey(body)}`;
  if (
    await hasRecordedPaymentStatus({
      siteSlug,
      orderId,
      paymentId,
      status: internalStatus,
    })
  ) {
    return { ok: true };
  }
  const eventRecord = await recordPaymentEvent({
    siteSlug,
    orderId,
    eventType: "webhook",
    status: internalStatus,
    paymentId,
    idempotencyKey,
    rawPayload: body,
  });
  if (eventRecord === "duplicate") return { ok: true };
  if (eventRecord === "error") {
    return { ok: false, status: 500, error: "Payment event audit failed" };
  }

  const paymentConfirmedNow = internalStatus === "paid" && !order.paid_at;
  const becamePaidLike =
    isTransitionToPaidLike(prevStatus, newStatus, siteSlug) || paymentConfirmedNow;
  const paidAtIso = paymentConfirmedNow ? new Date().toISOString() : undefined;

  const { data: updated, error: updateError } = await subs
    .from("orders")
    .update({
      status: newStatus,
      payment_status: newPaymentStatus,
      ...(paymentId ? { payment_external_id: paymentId } : {}),
      ...(paidAtIso ? { paid_at: paidAtIso } : {}),
    })
    .eq("id", orderId)
    .eq("status", prevStatus)
    .select("id");

  if (updateError || !updated?.length) {
    await releasePaymentEvent(idempotencyKey);
    console.error(
      "[Pally webhook] Subs order update failed:",
      updateError?.message ?? "concurrent status change",
      orderId,
    );
    return { ok: false, status: 500, error: "Order update failed" };
  }

  let planTitle = "Spotify Premium";
  if (order.tariff_id) {
    const { formatSubsTariffEmailLabel } = await import(
      "@/lib/admin/subs-tariff-display-label"
    );
    const { data: tariff } = await subs
      .from("tariffs")
      .select("title,slug,category,duration_months")
      .eq("id", order.tariff_id)
      .maybeSingle();
    if (tariff) {
      planTitle = formatSubsTariffEmailLabel(tariff);
    } else {
      console.warn(
        "[Pally webhook] Subs tariff mapping missing for",
        String(order.tariff_id).slice(0, 8),
      );
    }
  }

  const customerEmail = await resolveSubsOrderCustomerEmail({
    subsAdmin: subs,
    userId: order.user_id,
    customerEmail: order.customer_email,
  });
  const price = Number(order.final_price) || 0;

  if (becamePaidLike) {
    await incrementSubsPromocodeUsage(subs, order.promocode_code).catch(() => undefined);
    if (order.promocode_code?.trim()) {
      const { emailStaffPromocodeUsed } = await import("@/lib/email/notify-hooks");
      void emailStaffPromocodeUsed({
        siteSlug,
        code: order.promocode_code.trim(),
        orderId: order.id,
      }).catch(() => undefined);
    }
  }

  if (becamePaidLike) {
    void handleOrderPaidNotification({
      orderId: order.id,
      siteSlug,
      planName: planTitle,
      price,
      status: internalStatus === "paid" ? "paid" : newStatus,
      customerEmail,
      customerUserId: order.user_id,
      accountEmail: customerEmail ?? undefined,
      paidAt: new Date().toISOString(),
    }).catch(() => undefined);

    void notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price,
        account_email: customerEmail ?? undefined,
      },
      internalStatus === "paid" ? "paid" : newStatus,
      { siteSlug, skipStaffInAppAndEmail: true },
    ).catch(() => undefined);

    if (order.user_id) {
      void import("@/lib/subs/subs-notifications")
        .then(({ notifySubsStoreCustomerOrderStatus }) =>
          notifySubsStoreCustomerOrderStatus({
            orderId: order.id,
            customerUserId: order.user_id!,
            status: newStatus,
            planLabel: planTitle,
          }),
        )
        .catch(() => undefined);
    }
  } else if (!becamePaidLike) {
    void notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price,
        account_email: customerEmail ?? undefined,
      },
      internalStatus === "paid" ? "paid" : newStatus,
      { siteSlug },
    ).catch(() => undefined);
    if (customerEmail) {
      void notifyCustomerOrderStatus({
        customerEmail,
        customerUserId: order.user_id,
        orderId: order.id,
        planName: planTitle,
        status: newStatus,
        price,
        siteSlug,
      }).catch(() => {});
    }
    if (order.user_id) {
      void import("@/lib/subs/subs-notifications")
        .then(({ notifySubsStoreCustomerOrderStatus }) =>
          notifySubsStoreCustomerOrderStatus({
            orderId: order.id,
            customerUserId: order.user_id!,
            status: newStatus,
            planLabel: planTitle,
          }),
        )
        .catch(() => undefined);
    }
  }

  return { ok: true };
}

function pallyStatusKey(body: PallyWebhookPayload): string {
  return String(body.status ?? "unknown");
}

function readPallyStatus(body: PallyWebhookPayload): string {
  return String(body.status ?? "");
}

function readOrderId(body: PallyWebhookPayload): string {
  return String(body.order_id ?? body.orderId ?? "");
}

export async function processPallyWebhook(
  body: PallyWebhookPayload,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const orderId = readOrderId(body);
  const pallyStatus = readPallyStatus(body);
  if (!orderId) {
    return { ok: false, status: 400, error: "Нет order_id" };
  }

  const internalStatus = mapPallyStatus(pallyStatus);
  const paymentId = paymentIdFromBody(body);

  const siteHint = String(body.site ?? body.site_slug ?? "").toLowerCase();
  if (siteHint.includes("subs") || siteHint.includes("spotify")) {
    const subsResult = await processSubsOrder(orderId, internalStatus, body, paymentId);
    if (subsResult.ok) return subsResult;
  }

  const gptResult = await processGptOrder(orderId, internalStatus, body, paymentId);
  if (gptResult.ok) return gptResult;

  const subsResult = await processSubsOrder(orderId, internalStatus, body, paymentId);
  if (subsResult.ok) return subsResult;

  return subsResult;
}
