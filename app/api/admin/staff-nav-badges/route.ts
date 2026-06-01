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
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { resolveServerRole } from "@/lib/auth/server-role";
import { createAdminClient, createClient } from "@/lib/supabase/server";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { user, role, admin: createAdminClient() };
}

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
    const { subs, user, role } = ctx;

    let ordersQ = subs.from("orders").select("id", { count: "exact", head: true });
    if (ordersSince) ordersQ = ordersQ.gt("created_at", ordersSince);
    const ordersRes = await ordersQ;

    const [chatUnread, notifUnread] = await Promise.all([
      countSubsStoreUnreadClientMessages(subs),
      countSubsStoreUnreadNotifications(subs, { userId: user.id, role }),
    ]);

    return NextResponse.json({
      notifications: notifUnread,
      chat: chatUnread,
      orders: ordersRes.count ?? 0,
    });
  }

  const ctx = await requireStaff();
  if (ctx instanceof NextResponse) return ctx;
  const { admin, user, role } = ctx;

  const gptSiteId = await getSiteUUID("gpt-store");
  let ordersQ = admin.from("orders").select("id", { count: "exact", head: true });
  if (gptSiteId) ordersQ = ordersQ.eq("site_id", gptSiteId);
  if (ordersSince) ordersQ = ordersQ.gt("created_at", ordersSince);

  const [ordersRes, chatUnread, notifUnread] = await Promise.all([
    ordersQ,
    countGptStoreUnreadClientMessages(admin, "gpt-store"),
    countGptStoreUnreadNotifications(admin, {
      userId: user.id,
      role,
      siteSlug: "gpt-store",
    }),
  ]);

  return NextResponse.json({
    notifications: notifUnread,
    chat: chatUnread,
    orders: ordersRes.count ?? 0,
  });
}
