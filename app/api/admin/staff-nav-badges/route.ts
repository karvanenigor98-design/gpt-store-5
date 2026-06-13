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
  gptAdmin: SupabaseClient,
): Promise<number> {
  let total = 0;
  if (accessible.includes("gpt-store")) {
    total += await countGptStoreUnreadNotifications(gptAdmin, {
      userId,
      role,
      siteSlug: "gpt-store",
    });
  }
  if (accessible.includes("subs-store")) {
    const subsCtx = await requireSubsStaffContext();
    if (!(subsCtx instanceof NextResponse)) {
      total += await countSubsStoreUnreadNotifications(subsCtx.subs, { userId, role });
    }
  }
  return total;
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
  const notifUnread = await countCombinedStaffNotifications(accessible, user.id, role, admin);

  if (siteSlug === "subs-store") {
    const subsCtx = await requireSubsStaffContext();
    if (subsCtx instanceof NextResponse) return subsCtx;
    const { subs } = subsCtx;

    let ordersQ = subs.from("orders").select("id", { count: "exact", head: true });
    if (ordersSince) ordersQ = ordersQ.gt("created_at", ordersSince);
    const [ordersRes, chatUnread] = await Promise.all([
      ordersQ,
      countSubsStoreUnreadClientMessages(subs),
    ]);

    return NextResponse.json({
      notifications: notifUnread,
      chat: chatUnread,
      orders: ordersRes.count ?? 0,
    });
  }

  const gptSiteId = await getSiteUUID("gpt-store");
  let ordersQ = admin.from("orders").select("id", { count: "exact", head: true });
  if (gptSiteId) ordersQ = ordersQ.eq("site_id", gptSiteId);
  if (ordersSince) ordersQ = ordersQ.gt("created_at", ordersSince);

  const [ordersRes, chatUnread] = await Promise.all([
    ordersQ,
    countGptStoreUnreadClientMessages(admin, "gpt-store"),
  ]);

  return NextResponse.json({
    notifications: notifUnread,
    chat: chatUnread,
    orders: ordersRes.count ?? 0,
  });
}
