import { NextRequest, NextResponse } from "next/server";

import {
  countGptStoreUnreadClientMessages,
  countSubsStoreUnreadClientMessages,
} from "@/lib/admin/staff-chat-unread-count";
import {
  countGptStoreUnreadNotifications,
  countSubsStoreUnreadNotifications,
} from "@/lib/admin/staff-notification-unread-count";
import { getSiteUUID } from "@/lib/admin/getSiteId";
import { listAccessibleAdminSiteSlugs } from "@/lib/admin/subs-api-guard";
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { requireStaffApi } from "@/lib/admin/require-staff-api";

function parseOrdersSince(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const t = Date.parse(raw.trim());
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

export async function GET(req: NextRequest) {
  const siteSlug = req.nextUrl.searchParams.get("site") === "subs-store" ? "subs-store" : "gpt-store";
  const ordersSince = parseOrdersSince(req.nextUrl.searchParams.get("ordersSince"));

  if (siteSlug === "subs-store") {
    const ctx = await requireSubsStaffContext();
    if (ctx instanceof NextResponse) return ctx;
    const { subs, gptAdmin, user, role } = ctx;

    let ordersQ = subs.from("orders").select("id", { count: "exact", head: true });
    if (ordersSince) ordersQ = ordersQ.gt("created_at", ordersSince);
    const ordersRes = await ordersQ;

    const accessible = await listAccessibleAdminSiteSlugs(user, gptAdmin, role);
    let notifUnread = 0;
    if (accessible.includes("subs-store")) {
      notifUnread = await countSubsStoreUnreadNotifications(subs, { userId: user.id, role });
    }

    const chatUnread = await countSubsStoreUnreadClientMessages(subs);

    return NextResponse.json({
      notifications: notifUnread,
      chat: chatUnread,
      orders: ordersRes.count ?? 0,
    });
  }

  const ctx = await requireStaffApi();
  if (ctx instanceof NextResponse) return ctx;
  const { admin, user, role } = ctx;

  const accessible = await listAccessibleAdminSiteSlugs(user, admin, role);
  const gptSiteId = await getSiteUUID("gpt-store");
  let ordersQ = admin.from("orders").select("id", { count: "exact", head: true });
  if (gptSiteId) ordersQ = ordersQ.eq("site_id", gptSiteId);
  if (ordersSince) ordersQ = ordersQ.gt("created_at", ordersSince);

  let notifUnread = 0;
  if (accessible.includes("gpt-store")) {
    notifUnread = await countGptStoreUnreadNotifications(admin, {
      userId: user.id,
      role,
      siteSlug: "gpt-store",
    });
  }

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
