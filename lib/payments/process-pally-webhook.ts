import { incrementSubsPromocodeUsage } from "@/lib/admin/subs-discount-db";
import { incrementPromocodeUsage } from "@/lib/promocodes/db-promo";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { createAdminClient } from "@/lib/supabase/server";
import { mapPallyStatus } from "@/lib/payments/pally";
import {
  handleOrderPaidNotification,
  isTransitionToPaidLike,
} from "@/lib/notifications/order-paid";
import { notifyCustomerOrderStatus, notifyPaymentStatus } from "@/lib/telegram/notifications";
import type { OrderStatus } from "@/types/database";
import type { SiteSlug } from "@/lib/sites";

export type PallyWebhookPayload = Record<string, unknown>;

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
}): Promise<boolean> {
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
    if (error?.code === "23505") return false;
    if (error) {
      console.warn("[Pally webhook] payment_events:", error.message);
      return true;
    }
    return true;
  } catch {
    return true;
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
  const prevStatus = String(order.status);
  const newStatus: OrderStatus =
    internalStatus === "paid" ? "activating" : (internalStatus as OrderStatus);

  const idempotencyKey = `pally:${orderId}:${paymentId ?? pallyStatusKey(body)}`;
  const isNewEvent = await recordPaymentEvent({
    siteSlug,
    orderId,
    eventType: "webhook",
    status: internalStatus,
    paymentId,
    idempotencyKey,
    rawPayload: body,
  });

  await supabase
    .from("orders")
    .update({
      status: newStatus,
      ...(paymentId ? { payment_id: paymentId, pally_order_id: paymentId } : {}),
    })
    .eq("id", orderId);

  const becamePaidLike = isTransitionToPaidLike(prevStatus, newStatus, siteSlug);
  if (!isNewEvent && becamePaidLike) {
    return { ok: true };
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

  let customerEmail: string | null = null;
  if (order.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", order.user_id)
      .maybeSingle();
    customerEmail = profile?.email?.trim().toLowerCase() ?? null;
  }

  if (becamePaidLike && isNewEvent) {
    void handleOrderPaidNotification({
      orderId: order.id,
      siteSlug,
      planName: planTitle,
      price: order.price,
      status: newStatus,
      customerEmail,
      customerUserId: order.user_id,
      accountEmail: order.account_email ?? undefined,
      paidAt: new Date().toISOString(),
    }).catch(() => undefined);

    await notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price: order.price,
        account_email: order.account_email ?? undefined,
      },
      newStatus,
      { siteSlug, skipStaffInAppAndEmail: true },
    );
  } else if (!becamePaidLike) {
    await notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price: order.price,
        account_email: order.account_email ?? undefined,
      },
      newStatus,
      { siteSlug },
    );
    if (customerEmail) {
      await notifyCustomerOrderStatus({
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
    .select("id,status,payment_status,final_price,customer_email,user_id,tariff_id,promocode_code")
    .eq("id", orderId)
    .maybeSingle();

  if (findError || !order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  const siteSlug: SiteSlug = "subs-store";
  const prevStatus = String(order.status);
  const newStatus =
    internalStatus === "paid"
      ? "processing"
      : internalStatus === "failed"
        ? "cancelled"
        : prevStatus;
  const newPaymentStatus =
    internalStatus === "paid"
      ? "paid"
      : internalStatus === "failed"
        ? "failed"
        : order.payment_status;

  const idempotencyKey = `pally:subs:${orderId}:${paymentId ?? pallyStatusKey(body)}`;
  const isNewEvent = await recordPaymentEvent({
    siteSlug,
    orderId,
    eventType: "webhook",
    status: internalStatus,
    paymentId,
    idempotencyKey,
    rawPayload: body,
  });

  await subs
    .from("orders")
    .update({
      status: newStatus,
      payment_status: newPaymentStatus,
      ...(paymentId ? { payment_external_id: paymentId } : {}),
    })
    .eq("id", orderId);

  const becamePaidLike = isTransitionToPaidLike(prevStatus, newStatus, siteSlug);
  if (!isNewEvent && becamePaidLike) {
    return { ok: true };
  }

  let planTitle = "Spotify Premium";
  if (order.tariff_id) {
    const { data: tariff } = await subs
      .from("tariffs")
      .select("title")
      .eq("id", order.tariff_id)
      .maybeSingle();
    if (tariff?.title) planTitle = tariff.title;
  }

  const customerEmail = order.customer_email?.trim().toLowerCase() ?? null;
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

  if (becamePaidLike && isNewEvent) {
    void handleOrderPaidNotification({
      orderId: order.id,
      siteSlug,
      planName: planTitle,
      price,
      status: newStatus,
      customerEmail,
      customerUserId: order.user_id,
      accountEmail: customerEmail ?? undefined,
      paidAt: new Date().toISOString(),
    }).catch(() => undefined);

    await notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price,
        account_email: customerEmail ?? undefined,
      },
      newStatus,
      { siteSlug, skipStaffInAppAndEmail: true },
    );
  } else if (!becamePaidLike) {
    await notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price,
        account_email: customerEmail ?? undefined,
      },
      newStatus,
      { siteSlug },
    );
    if (customerEmail) {
      await notifyCustomerOrderStatus({
        customerEmail,
        customerUserId: order.user_id,
        orderId: order.id,
        planName: planTitle,
        status: newStatus,
        price,
        siteSlug,
      }).catch(() => {});
    }
  }

  return { ok: true };
}

function pallyStatusKey(body: PallyWebhookPayload): string {
  return String(body.status ?? "unknown");
}

export async function processPallyWebhook(
  body: PallyWebhookPayload,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const orderId = String(body.order_id ?? body.orderId ?? "");
  const pallyStatus = String(body.status ?? "");
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
