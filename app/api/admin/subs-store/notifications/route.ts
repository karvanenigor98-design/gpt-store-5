import { NextRequest, NextResponse } from "next/server";

import {
  isNotificationUnreadForStaff,
  loadStaffReadNotificationIds,
  markAllStaffNotificationsReadForUser,
  markStaffNotificationRead,
  resolveStaffNotificationUserId,
} from "@/lib/admin/staff-notification-reads";
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { resolveSubsInboxRecipientUserId } from "@/lib/subs/subs-notifications";

/** Subs notifications — другая схема, без site_id. */
export async function GET() {
  const ctx = await requireSubsStaffContext({ skipSiteMembershipCheck: true });
  if (ctx instanceof NextResponse) return ctx;
  const sharedInboxUserId = await resolveSubsInboxRecipientUserId(ctx.subs);

  const query = ctx.subs.from("notifications").select("*").order("created_at", { ascending: false }).limit(120);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Не удалось загрузить уведомления" }, { status: 500 });
  }

  const readIds = await loadStaffReadNotificationIds(
    ctx.subs,
    await resolveStaffNotificationUserId(ctx.subs, {
      userId: ctx.user.id,
      email: ctx.user.email,
      role: ctx.role,
    }),
  );

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
      const unread = isNotificationUnreadForStaff(r, ctx.user.id, ctx.role, readIds, {
        sharedInboxUserId,
      });
      return { ...row, is_read: !unread };
    });

  return NextResponse.json({ items: items.slice(0, 100) });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireSubsStaffContext({ skipSiteMembershipCheck: true });
  if (ctx instanceof NextResponse) return ctx;
  const sharedInboxUserId = await resolveSubsInboxRecipientUserId(ctx.subs);

  let body: { id?: string; mark_all?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  if (body.mark_all) {
    const result = await markAllStaffNotificationsReadForUser(ctx.subs, {
      userId: ctx.user.id,
      role: ctx.role,
      siteSlug: "subs-store",
      email: ctx.user.email,
      sharedInboxUserId,
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

  await markStaffNotificationRead(ctx.subs, {
    notificationId: id,
    userId: ctx.user.id,
    role: ctx.role,
    email: ctx.user.email,
    sharedInboxUserId,
  });
  return NextResponse.json({ ok: true });
}
