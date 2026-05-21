import { NextRequest, NextResponse } from "next/server";

import {
  countGptStoreUnreadClientMessages,
  countSubsStoreUnreadClientMessages,
} from "@/lib/admin/staff-chat-unread-count";
import {
  countGptStoreUnreadNotifications,
  countSubsStoreUnreadNotifications,
} from "@/lib/admin/staff-notification-unread-count";
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
  return { admin: createAdminClient() };
}

export async function GET(req: NextRequest) {
  const siteSlug = req.nextUrl.searchParams.get("site") === "subs-store" ? "subs-store" : "gpt-store";

  if (siteSlug === "subs-store") {
    const ctx = await requireSubsStaffContext();
    if (ctx instanceof NextResponse) return ctx;
    const { subs } = ctx;

    const ordersRes = await subs
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "awaiting_payment", "awaiting_operator", "problem"]);

    const [chatUnread, notifUnread] = await Promise.all([
      countSubsStoreUnreadClientMessages(subs),
      countSubsStoreUnreadNotifications(subs),
    ]);

    return NextResponse.json({
      notifications: notifUnread,
      chat: chatUnread,
      orders: ordersRes.count ?? 0,
    });
  }

  const ctx = await requireStaff();
  if (ctx instanceof NextResponse) return ctx;
  const { admin } = ctx;

  const ordersQ = admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .not("product", "ilike", "spotify%");

  const [ordersRes, chatUnread, notifUnread] = await Promise.all([
    ordersQ,
    countGptStoreUnreadClientMessages(admin, "gpt-store"),
    countGptStoreUnreadNotifications(admin, "gpt-store"),
  ]);

  return NextResponse.json({
    notifications: notifUnread,
    chat: chatUnread,
    orders: ordersRes.count ?? 0,
  });
}
