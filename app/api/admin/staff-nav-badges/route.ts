import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  countGptStoreUnreadClientMessages,
  countSubsStoreUnreadClientMessages,
} from "@/lib/admin/staff-chat-unread-count";
import {
  countGptStoreUnreadNotifications,
  countSubsStoreUnreadNotifications,
} from "@/lib/admin/staff-notification-unread-count";
import { getSiteUUID } from "@/lib/admin/getSiteId";
import { listAccessibleAdminSiteSlugs, requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { requireStaffApi } from "@/lib/admin/require-staff-api";
import { resolveSubsInboxRecipientUserId } from "@/lib/subs/subs-notifications";
import { withTimeout } from "@/lib/with-timeout";

const SUBS_CTX_TIMEOUT_MS = 4000;

function parseOrdersSince(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const t = Date.parse(raw.trim());
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

async function countCombinedStaffNotifications(
  accessible: ("gpt-store" | "subs-store")[],
  userId: string,
  role: "admin" | "operator",
  userEmail: string | null | undefined,
  gptAdmin: SupabaseClient,
  subsClient: SupabaseClient | null,
  subsSharedInboxUserId: string | null,
): Promise<number> {
  const counts: Promise<number>[] = [];
  if (accessible.includes("gpt-store")) {
    counts.push(withTimeout(
      countGptStoreUnreadNotifications(gptAdmin, {
        userId,
        role,
        siteSlug: "gpt-store",
        email: userEmail,
      }),
      5000,
      0,
    ));
  }
  if (accessible.includes("subs-store") && subsClient) {
    counts.push(withTimeout(
      countSubsStoreUnreadNotifications(subsClient, {
        userId,
        role,
        email: userEmail,
        sharedInboxUserId: subsSharedInboxUserId,
      }),
      5000,
      0,
    ));
  }
  return (await Promise.all(counts)).reduce((sum, count) => sum + count, 0);
}

export async function GET(req: NextRequest) {
  const siteSlug = req.nextUrl.searchParams.get("site") === "subs-store" ? "subs-store" : "gpt-store";
  const ordersSince = parseOrdersSince(req.nextUrl.searchParams.get("ordersSince"));

  const ctx = await requireStaffApi();
  if (ctx instanceof NextResponse) return ctx;
  const { admin, user, role } = ctx;

  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accessible = await listAccessibleAdminSiteSlugs(user, admin, role);

  let subsClient: SupabaseClient | null = null;
  let subsSharedInboxUserId: string | null = null;
  if (accessible.includes("subs-store")) {
    const subsCtx = await withTimeout(
      requireSubsStaffContext({ skipSiteMembershipCheck: true }),
      SUBS_CTX_TIMEOUT_MS,
      null,
    );
    if (subsCtx && !(subsCtx instanceof NextResponse)) {
      subsClient = subsCtx.subs;
      subsSharedInboxUserId = await resolveSubsInboxRecipientUserId(subsClient);
    }
  }

  const notifUnreadPromise = countCombinedStaffNotifications(
    accessible,
    user.id,
    role,
    user.email,
    admin,
    subsClient,
    subsSharedInboxUserId,
  );

  if (siteSlug === "subs-store") {
    if (!subsClient) {
      return NextResponse.json({
        notifications: await notifUnreadPromise,
        chat: 0,
        orders: 0,
        reviews: 0,
      });
    }
    const subs = subsClient;

    let ordersQ = subs.from("orders").select("id", { count: "exact", head: true });
    if (ordersSince) ordersQ = ordersQ.gt("created_at", ordersSince);
    const reviewsPendingPromise = (async () => {
      const { count } = await subs
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    })();

    const [ordersRes, chatUnread, notifUnread, reviewsCount] = await Promise.all([
      ordersQ,
      withTimeout(countSubsStoreUnreadClientMessages(subs), 5000, 0),
      notifUnreadPromise,
      withTimeout(reviewsPendingPromise, 5000, 0),
    ]);

    return NextResponse.json({
      notifications: notifUnread,
      chat: chatUnread,
      orders: ordersRes.count ?? 0,
      reviews: reviewsCount,
    });
  }

  const gptSiteId = await getSiteUUID("gpt-store");
  let ordersQ = admin.from("orders").select("id", { count: "exact", head: true });
  if (gptSiteId) ordersQ = ordersQ.eq("site_id", gptSiteId);
  if (ordersSince) ordersQ = ordersQ.gt("created_at", ordersSince);

  const reviewsPendingPromise = (async () => {
    let q = admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if (gptSiteId) q = q.eq("site_id", gptSiteId);
    const { count } = await q;
    return count ?? 0;
  })();

  const [ordersRes, chatUnread, notifUnread, reviewsCount] = await Promise.all([
    ordersQ,
    withTimeout(countGptStoreUnreadClientMessages(admin, "gpt-store"), 5000, 0),
    notifUnreadPromise,
    withTimeout(reviewsPendingPromise, 5000, 0),
  ]);

  return NextResponse.json({
    notifications: notifUnread,
    chat: chatUnread,
    orders: ordersRes.count ?? 0,
    reviews: reviewsCount,
  });
}
