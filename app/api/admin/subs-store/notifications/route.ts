import { NextRequest, NextResponse } from "next/server";

import {
  isNotificationUnreadForStaff,
  loadStaffReadNotificationIds,
  markAllStaffBroadcastNotificationsRead,
  markStaffNotificationRead,
} from "@/lib/admin/staff-notification-reads";
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";

/** Subs notifications — другая схема, без site_id. */
export async function GET() {
  const ctx = await requireSubsStaffContext();
  if (ctx instanceof NextResponse) return ctx;

  const query = ctx.subs.from("notifications").select("*").order("created_at", { ascending: false }).limit(120);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Не удалось загрузить уведомления" }, { status: 500 });
  }

  const readIds = await loadStaffReadNotificationIds(ctx.subs, ctx.user.id);

  const items = (data ?? [])
    .filter((row) => {
      const t = (row as { type?: string }).type;
      return t !== "chat_reply";
    })
    .map((row) => {
      const r = row as {
        id: string;
        recipient_user_id: string | null;
        recipient_role: string | null;
        is_read: boolean;
        type?: string;
      };
      const unread = isNotificationUnreadForStaff(r, ctx.user.id, ctx.role, readIds);
      return { ...row, is_read: !unread };
    });

  return NextResponse.json({ items: items.slice(0, 100) });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireSubsStaffContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: { id?: string; mark_all?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  if (body.mark_all) {
    await markAllStaffBroadcastNotificationsRead(ctx.subs, {
      userId: ctx.user.id,
      siteSlug: "subs-store",
    });
    return NextResponse.json({ ok: true });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  await markStaffNotificationRead(ctx.subs, { notificationId: id, userId: ctx.user.id });
  return NextResponse.json({ ok: true });
}
