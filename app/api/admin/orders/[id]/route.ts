import { NextRequest, NextResponse } from "next/server";

import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { resolveServerRole } from "@/lib/auth/server-role";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/types/database";
import {
  handleOrderPaidNotification,
  isTransitionToPaidLike,
} from "@/lib/notifications/order-paid";
import { notifyCustomerOrderStatus, notifyManualOrderStatusChange } from "@/lib/telegram/notifications";
import {
  fetchSubsOrderForStatusPatch,
  buildSubsOrderActivationPatch,
  subsPaymentStatusForOrderStatus,
} from "@/lib/admin/patch-subs-order-status";
import {
  inferGptPlanDurationMonths,
  resolveOrderSubscriptionExpiresAt,
} from "@/lib/admin/admin-subscription-label";

const SUBS_ORDER_STATUSES = new Set([
  "new",
  "awaiting_payment",
  "pending_payment_setup",
  "awaiting_operator",
  "paid",
  "processing",
  "awaiting_data",
  "activated",
  "completed",
  "problem",
  "refund",
  "cancelled",
]);

const ALLOWED: OrderStatus[] = [
  "pending",
  "paid",
  "activating",
  "waiting_client",
  "active",
  "failed",
  "refunded",
  "expired",
];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;
  if (!orderId) {
    return NextResponse.json({ error: "Нет id" }, { status: 400 });
  }

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const next = body.status as OrderStatus;
  if (!next) {
    return NextResponse.json({ error: "Нет статуса" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const site = req.nextUrl.searchParams.get("site");
  if (site === "subs-store") {
    const subsCtx = await requireSubsStaffContext();
    if (subsCtx instanceof NextResponse) return subsCtx;
    const nextSubs = String(next);
    if (!SUBS_ORDER_STATUSES.has(nextSubs)) {
      return NextResponse.json({ error: "Недопустимый статус для Subs Store" }, { status: 400 });
    }
    const order = await fetchSubsOrderForStatusPatch(subsCtx.subs, orderId);
    if (!order) {
      return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    }
    const prev = order.status;
    if (prev === nextSubs) {
      return NextResponse.json({ ok: true, status: nextSubs });
    }

    const nextPaymentStatus = subsPaymentStatusForOrderStatus(nextSubs);
    const updatePayload: Record<string, unknown> = {
      status: nextSubs,
      updated_at: new Date().toISOString(),
      ...buildSubsOrderActivationPatch(order, nextSubs),
    };
    if (nextPaymentStatus) {
      updatePayload.payment_status = nextPaymentStatus;
    }

    const { error: updErr } = await subsCtx.subs
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId);
    if (updErr) {
      console.error("[admin/orders PATCH subs]", updErr.message);
      return NextResponse.json({ error: "Не удалось обновить" }, { status: 500 });
    }

    const userId = order.user_id;
    const planTitle = order.planTitle;

    let subsEmail = order.customer_email?.trim().toLowerCase() ?? null;
    if (userId) {
      const { data: subsProfile } = await subsCtx.subs.auth.admin.getUserById(userId);
      subsEmail = subsProfile?.user?.email?.trim().toLowerCase() ?? subsEmail;
    }

    const becamePaidSubs = isTransitionToPaidLike(prev, nextSubs, "subs-store");
    if (becamePaidSubs && userId) {
      const { processReferralRewardOnFirstPaidOrder } = await import("@/lib/referrals/db");
      void processReferralRewardOnFirstPaidOrder({
        siteSlug: "subs-store",
        referredUserId: userId,
        orderId,
      }).catch(() => undefined);
    }

    if (becamePaidSubs) {
      void handleOrderPaidNotification({
        orderId,
        siteSlug: "subs-store",
        planName: planTitle,
        price: Number(order.final_price ?? 0),
        status: nextSubs,
        customerEmail: subsEmail,
        customerUserId: userId ?? undefined,
        paidAt: new Date().toISOString(),
      }).catch(() => undefined);
    }

    if (userId) {
      const { notifySubsStoreCustomerOrderStatus } = await import("@/lib/subs/subs-notifications");
      void notifySubsStoreCustomerOrderStatus({
        orderId,
        customerUserId: userId,
        status: nextSubs,
        planLabel: planTitle,
      }).catch(() => undefined);

      if (subsEmail && !becamePaidSubs) {
        void notifyCustomerOrderStatus({
          customerEmail: subsEmail,
          customerUserId: userId,
          orderId,
          planName: planTitle,
          status: nextSubs,
          price: Number(order.final_price ?? 0),
          siteSlug: "subs-store",
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({ ok: true, status: nextSubs });
  }

  if (!ALLOWED.includes(next)) {
    return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: order, error: findErr } = await admin.from("orders").select("*").eq("id", orderId).single();

  if (findErr || !order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const prev = order.status as OrderStatus;
  if (prev === next) {
    return NextResponse.json({ ok: true, status: next });
  }

  const gptUpdate: {
    status: OrderStatus;
    activated_at?: string;
    expires_at?: string;
  } = { status: next };
  if (next === "active") {
    const nowIso = new Date().toISOString();
    if (!order.activated_at) gptUpdate.activated_at = nowIso;
    if (!order.expires_at) {
      const expiresAt = resolveOrderSubscriptionExpiresAt({
        activated_at: (order.activated_at as string | null) ?? nowIso,
        paid_at: (order.paid_at as string | null) ?? null,
        durationMonths: inferGptPlanDurationMonths(String(order.plan_id ?? "")),
      });
      if (expiresAt) gptUpdate.expires_at = expiresAt;
    }
  }

  const { error: updErr } = await admin.from("orders").update(gptUpdate).eq("id", orderId);
  if (updErr) {
    return NextResponse.json({ error: "Не удалось обновить" }, { status: 500 });
  }

  const planTitle = order.plan_name?.trim() || order.plan_id;
  const meta = order.meta as Record<string, unknown> | null;
  const siteSlug =
    order.product === "spotify-premium" || meta?.site === "subs-store"
      ? ("subs-store" as const)
      : ("gpt-store" as const);

  const becamePaidGpt = isTransitionToPaidLike(prev, next, siteSlug);

  let customerEmail: string | null = null;
  if (order.user_id) {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", order.user_id).maybeSingle();
    customerEmail = profile?.email?.trim().toLowerCase() ?? null;
  }

  if (becamePaidGpt && order.user_id) {
    const { processReferralRewardOnFirstPaidOrder } = await import("@/lib/referrals/db");
    void processReferralRewardOnFirstPaidOrder({
      siteSlug,
      referredUserId: order.user_id,
      orderId: order.id,
    }).catch(() => undefined);
  }

  if (becamePaidGpt) {
    void handleOrderPaidNotification({
      orderId: order.id,
      siteSlug,
      planName: planTitle,
      price: order.price,
      status: next,
      customerEmail,
      customerUserId: order.user_id,
      accountEmail: order.account_email ?? undefined,
      paidAt: new Date().toISOString(),
    }).catch(() => undefined);
  } else {
    await notifyManualOrderStatusChange({
      id: order.id,
      plan_name: planTitle,
      plan_id: order.plan_id,
      price: order.price,
      account_email: order.account_email,
      prev,
      next,
    }).catch(() => {});
  }

  if (order.user_id) {
    const { notifyGptCustomerOrderStatus } = await import("@/lib/notifications/gpt-customer-notifications");
    void notifyGptCustomerOrderStatus({
      orderId: order.id,
      customerUserId: order.user_id,
      status: next,
      planLabel: planTitle,
    }).catch(() => undefined);

    if (customerEmail && !becamePaidGpt) {
      await notifyCustomerOrderStatus({
        customerEmail,
        customerUserId: order.user_id,
        orderId: order.id,
        planName: planTitle,
        status: next,
        price: order.price,
        siteSlug,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, status: next });
}
