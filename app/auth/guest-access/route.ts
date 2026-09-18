import { NextRequest, NextResponse } from "next/server";

import {
  establishGptMagicSession,
  guestAccessRedirectPath,
  verifyGuestOrderAccess,
  type GuestAccessNext,
} from "@/lib/auth/guest-order-access";
import { upsertSiteMembership } from "@/lib/auth/siteMembership";
import { syncProfileRoleForUser } from "@/lib/auth/syncProfileRole";
import { clearSiteUiLogout } from "@/lib/auth/siteUiSession";
import { isCustomerOrderPaidLike } from "@/lib/dashboard/resolve-customer-order-status";
import { createAdminClient } from "@/lib/supabase/server";

export const maxDuration = 30;

function failRedirect(origin: string, code: string): NextResponse {
  const q = new URLSearchParams({ site: "gpt-store", error: code });
  return NextResponse.redirect(`${origin}/login?${q.toString()}`);
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const orderId = request.nextUrl.searchParams.get("order")?.trim() ?? "";
  const sig = request.nextUrl.searchParams.get("sig")?.trim() ?? "";
  const nextRaw = request.nextUrl.searchParams.get("next")?.trim() ?? "chat";
  const next: GuestAccessNext = nextRaw === "account" ? "account" : "chat";

  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !verifyGuestOrderAccess(orderId, sig)) {
    return failRedirect(origin, "callback");
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id,user_id,status,meta")
    .eq("id", orderId)
    .maybeSingle();

  const meta = (order?.meta ?? null) as Record<string, unknown> | null;
  const paid = isCustomerOrderPaidLike({
    siteSlug: "gpt-store",
    status: order?.status,
  });
  if (!order?.user_id || !paid || meta?.guest_checkout !== true) {
    return failRedirect(origin, "callback");
  }

  const { data: authUser, error: userErr } = await admin.auth.admin.getUserById(order.user_id);
  const email = authUser.user?.email?.trim();
  if (userErr || !email) {
    return failRedirect(origin, "callback");
  }

  if (!authUser.user?.email_confirmed_at) {
    await admin.auth.admin.updateUserById(order.user_id, { email_confirm: true });
  }

  const session = await establishGptMagicSession(email);
  if (!session.ok) {
    return failRedirect(origin, "callback");
  }

  await upsertSiteMembership(session.userId, "gpt-store", "customer").catch(() => undefined);
  await syncProfileRoleForUser(session.userId, email).catch(() => undefined);
  const { getOrCreateClientOperatorSession } = await import("@/lib/chat/operatorSession");
  await getOrCreateClientOperatorSession(admin, session.userId, "gpt-store").catch(() => undefined);

  const dest = guestAccessRedirectPath(orderId, next);
  const res = NextResponse.redirect(`${origin}${dest}`);
  for (const { name, value, options } of session.pending) {
    res.cookies.set(name, value, options ?? {});
  }
  clearSiteUiLogout(res, "gpt-store");
  res.cookies.set("current_site", "gpt-store", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
