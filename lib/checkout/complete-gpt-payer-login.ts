import { establishGptMagicSession } from "@/lib/auth/guest-order-access";
import { upsertSiteMembership } from "@/lib/auth/siteMembership";
import { syncProfileRoleForUser } from "@/lib/auth/syncProfileRole";
import { isPaidLikeStatus } from "@/lib/orders/paid-like-status";
import { appendCheckoutReturnCookie } from "@/lib/payments/checkout-return-cookie";
import { getCheckoutOrderPaymentState } from "@/lib/payments/get-checkout-order-status";
import { reconcileUnpaidOrderPayment } from "@/lib/payments/reconcile-unpaid-order";
import { clearSiteUiLogout } from "@/lib/auth/siteUiSession";
import { createAdminClient } from "@/lib/supabase/server";
import type { NextResponse } from "next/server";

const CHAT_HREF = "/dashboard/chat?site=gpt-store";
const LOOKBACK_MS = 72 * 60 * 60 * 1000;

export async function findRecentPaidGptOrderIdByEmail(emailRaw: string): Promise<string | null> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;

  const admin = createAdminClient();
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();

  const { data: byAccount } = await admin
    .from("orders")
    .select("id,status,account_email,user_id,created_at,paid_at")
    .ilike("account_email", email)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(25);

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  let byUser: typeof byAccount = [];
  if (profile?.id) {
    const { data } = await admin
      .from("orders")
      .select("id,status,account_email,user_id,created_at,paid_at")
      .eq("user_id", profile.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(25);
    byUser = data ?? [];
  }

  const seen = new Set<string>();
  const rows = [...(byAccount ?? []), ...byUser].filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  const paid = rows.filter((row) => isPaidLikeStatus(String(row.status ?? ""), "gpt-store"));
  paid.sort((a, b) => {
    const ta = Date.parse(String(a.paid_at ?? a.created_at ?? 0));
    const tb = Date.parse(String(b.paid_at ?? b.created_at ?? 0));
    return tb - ta;
  });
  return paid[0]?.id ?? null;
}

export function applyGptPayerSessionCookies(
  res: NextResponse,
  orderId: string,
  pending: { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }[],
): NextResponse {
  for (const { name, value, options } of pending) {
    res.cookies.set(name, value, options ?? {});
  }
  clearSiteUiLogout(res, "gpt-store");
  res.cookies.set("current_site", "gpt-store", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });
  appendCheckoutReturnCookie(res, "gpt-store", orderId);
  return res;
}

type SessionPending = Extract<
  Awaited<ReturnType<typeof establishGptMagicSession>>,
  { ok: true }
>["pending"];

/**
 * Log the buyer in on THIS device after a verified paid GPT order.
 * Account is created at Pay click; this only opens the session + chat.
 */
export async function completeGptPayerLogin(orderId: string): Promise<
  | { ok: true; redirectTo: string; pending: SessionPending }
  | { ok: false; pending: true }
  | { ok: false; error: string; status: number }
> {
  await reconcileUnpaidOrderPayment({ siteSlug: "gpt-store", orderId }).catch(() => undefined);

  const state = await getCheckoutOrderPaymentState("gpt-store", orderId);
  if (!state?.paidLike) {
    return { ok: false, pending: true };
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,user_id,meta,account_email,created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (!order?.user_id) {
    return { ok: false, error: "Order has no owner", status: 500 };
  }

  const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(order.user_id);
  const email = authUser.user?.email?.trim();
  if (userErr || !email) {
    return { ok: false, error: "User email missing", status: 500 };
  }

  if (!authUser.user?.email_confirmed_at) {
    await admin.auth.admin.updateUserById(order.user_id, { email_confirm: true });
  }

  const session = await establishGptMagicSession(email);
  if (!session.ok) {
    return { ok: false, error: session.error, status: 503 };
  }

  await upsertSiteMembership(session.userId, "gpt-store", "customer");
  await syncProfileRoleForUser(session.userId, email).catch(() => undefined);
  const { getOrCreateClientOperatorSession } = await import("@/lib/chat/operatorSession");
  await getOrCreateClientOperatorSession(admin, session.userId, "gpt-store").catch(() => undefined);

  const meta = (order.meta ?? null) as Record<string, unknown> | null;
  if (meta?.guest_checkout === true) {
    const checkoutOrigin =
      typeof meta.checkout_origin === "string" ? meta.checkout_origin : null;
    const { sendGuestOrderAccessEmail } = await import("@/lib/auth/send-guest-order-access-email");
    await sendGuestOrderAccessEmail({
      email,
      orderId,
      checkoutOrigin,
    }).catch(() => undefined);
  }

  return { ok: true, redirectTo: CHAT_HREF, pending: session.pending };
}

export { LOOKBACK_MS };
