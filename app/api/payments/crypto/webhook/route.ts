import { type NextRequest, NextResponse } from "next/server";
import { incrementPromocodeUsage } from "@/lib/promocodes/db-promo";
import { createAdminClient } from "@/lib/supabase/server";
import { mapCryptoStatus } from "@/lib/payments/crypto";
import {
  handleOrderPaidNotification,
  isTransitionToPaidLike,
  resolveGptOrderSiteSlug,
} from "@/lib/notifications/order-paid";
import { notifyCustomerOrderStatus, notifyPaymentStatus } from "@/lib/telegram/notifications";
import type { OrderStatus } from "@/types/database";

const GPT_FULFILLMENT_STATUSES = new Set(["activating", "waiting_client", "active"]);
const GPT_TERMINAL_STATUSES = new Set<OrderStatus>(["failed", "refunded", "expired"]);

function resolveGptOrderStatus(previous: OrderStatus, incoming: OrderStatus): OrderStatus {
  if (GPT_FULFILLMENT_STATUSES.has(previous) || previous === "refunded") return previous;
  if (previous === "paid" && incoming !== "refunded") return previous;
  if (GPT_TERMINAL_STATUSES.has(previous) && incoming !== "refunded") return previous;
  return incoming;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;

  const invoiceId = String(body.invoice_id ?? body.uuid ?? "");
  const status = String(body.status ?? "");

  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoice_id" }, { status: 400 });
  }

  const mapped = mapCryptoStatus(status);
  const incomingStatus = (mapped === "paid" ? "activating" : mapped) as OrderStatus;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*")
    .eq("payment_id", invoiceId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const prevStatus = String(order.status) as OrderStatus;
  const newOrderStatus = resolveGptOrderStatus(prevStatus, incomingStatus);
  const siteSlug = resolveGptOrderSiteSlug(order);

  // Idempotency / audit (shared payment_events table). Fail-open if table missing.
  const eventKey = `crypto:${invoiceId}:${incomingStatus}`;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: peErr } = await (supabase.from("payment_events") as any).insert({
      provider: "crypto",
      idempotency_key: eventKey,
      site_slug: siteSlug,
      order_id: order.id,
      status: incomingStatus,
      payment_id: invoiceId,
      payload: body,
    });
    if (peErr?.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
  } catch {
    /* table may not exist */
  }

  if (newOrderStatus !== prevStatus) {
    const { data: updated, error: updErr } = await supabase
      .from("orders")
      .update({ status: newOrderStatus })
      .eq("id", order.id)
      .eq("status", prevStatus)
      .select("id")
      .maybeSingle();

    if (updErr) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
    // CAS miss: another writer won — do not downgrade notifications on stale read.
    if (!updated) {
      return NextResponse.json({ ok: true, concurrent: true });
    }
  }

  const becamePaidLike = isTransitionToPaidLike(prevStatus, newOrderStatus, siteSlug);
  if (becamePaidLike) {
    const meta = order.meta as Record<string, unknown> | null;
    const promoCode = typeof meta?.promo_code === "string" ? meta.promo_code : null;
    await incrementPromocodeUsage(supabase, promoCode).catch(() => undefined);
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

  if (becamePaidLike) {
    void handleOrderPaidNotification({
      orderId: order.id,
      siteSlug,
      planName: planTitle,
      price: order.price,
      status: newOrderStatus,
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
      newOrderStatus,
      { siteSlug, skipStaffInAppAndEmail: true },
    ).catch(() => undefined);
  } else if (newOrderStatus !== prevStatus) {
    void notifyPaymentStatus(
      {
        id: order.id,
        plan_name: planTitle,
        price: order.price,
        account_email: order.account_email ?? undefined,
      },
      newOrderStatus,
      { siteSlug },
    ).catch(() => undefined);
    if (customerEmail) {
      void notifyCustomerOrderStatus({
        customerEmail,
        customerUserId: order.user_id,
        orderId: order.id,
        planName: planTitle,
        status: newOrderStatus,
        price: order.price,
        siteSlug,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
