import { NextRequest, NextResponse } from "next/server";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { requireStaffApi } from "@/lib/admin/require-staff-api";
import {
  countStaffUnreadNotifications,
  isNotificationUnreadForStaff,
  loadStaffReadNotificationIds,
  markAllStaffNotificationsReadForUser,
  markStaffNotificationRead,
  resolveStaffNotificationUserId,
} from "@/lib/admin/staff-notification-reads";

/** GPT Store notifications (таблица в GPT Supabase). Subs — /api/admin/subs-store/notifications */
export async function GET(req: NextRequest) {
  const ctx = await requireStaffApi();
  if (ctx instanceof NextResponse) return ctx;

  const siteSlug = req.nextUrl.searchParams.get("site") === "subs-store" ? "subs-store" : "gpt-store";
  const siteId = await getSiteUUID(siteSlug);

  let query = ctx.admin.from("notifications").select("*").order("created_at", { ascending: false }).limit(120);

  if (siteId) {
    if (siteSlug === "gpt-store") {
      const subsSiteId = await getSiteUUID("subs-store");
      const siteFilter = subsSiteId
        ? `site_id.eq.${siteId},site_id.eq.${subsSiteId},site_id.is.null`
        : `site_id.eq.${siteId},site_id.is.null`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).or(siteFilter) as typeof query;
    } else {
      query = query.eq("site_id", siteId);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Не удалось загрузить уведомления" }, { status: 500 });
  }

  const readIds = await loadStaffReadNotificationIds(
    ctx.admin,
    await resolveStaffNotificationUserId(ctx.admin, {
      userId: ctx.user.id,
      email: ctx.user.email,
      role: ctx.role,
    }),
  );

  const items = (data ?? [])
    .filter((row) => {
      const t = (row as { type?: string }).type;
      const role = (row as { recipient_role?: string | null }).recipient_role;
      if (role === "client") return false;
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

  const unread = await countStaffUnreadNotifications(ctx.admin, {
    userId: ctx.user.id,
    role: ctx.role,
    siteSlug,
    email: ctx.user.email,
  });

  return NextResponse.json({ items: items.slice(0, 100), unread });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireStaffApi();
  if (ctx instanceof NextResponse) return ctx;

  let body: { id?: string; mark_all?: boolean; site?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const siteSlug = body.site === "subs-store" ? "subs-store" : "gpt-store";

  if (body.mark_all) {
    const result = await markAllStaffNotificationsReadForUser(ctx.admin, {
      userId: ctx.user.id,
      role: ctx.role,
      siteSlug,
      email: ctx.user.email,
    });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Не удалось отметить уведомления" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, marked: result.marked });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  const result = await markStaffNotificationRead(ctx.admin, {
    notificationId: id,
    userId: ctx.user.id,
    role: ctx.role,
    email: ctx.user.email,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Не удалось отметить уведомление" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
