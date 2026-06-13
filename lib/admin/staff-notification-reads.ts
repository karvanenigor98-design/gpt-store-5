import type { SupabaseClient } from "@supabase/supabase-js";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import type { UserRole } from "@/types/database";

async function ensureStaffProfileForReads(
  admin: SupabaseClient,
  params: { userId: string; email?: string | null; role: UserRole },
): Promise<void> {
  const { data } = await admin.from("profiles").select("id").eq("id", params.userId).maybeSingle();
  if (data) return;

  const role = params.role === "admin" || params.role === "operator" ? params.role : "operator";
  await admin.from("profiles").insert({
    id: params.userId,
    email: params.email ?? null,
    role,
  });
}

type NotifRow = {
  id: string;
  recipient_user_id: string | null;
  recipient_role: string | null;
  is_read: boolean;
};

const STAFF_INBOX_TYPES = new Set([
  "new_order",
  "payment_success",
  "payment_failed",
  "new_chat_message",
  "new_review",
  "order_needs_data",
  "order_problem",
  "order_activated",
  "subscription_expiring",
]);

function isStaffInboxNotification(row: { type?: string }): boolean {
  const t = row.type;
  if (!t || t === "chat_reply") return false;
  if (!STAFF_INBOX_TYPES.has(t)) return false;
  return true;
}

function matchesRecipient(
  row: NotifRow & { type?: string },
  userId: string,
  role: UserRole,
): boolean {
  if (row.recipient_user_id === userId) return true;

  if (isStaffInboxNotification(row)) {
    return role === "admin" || role === "operator";
  }

  if (row.recipient_user_id) {
    return false;
  }
  if (row.recipient_role) {
    return row.recipient_role === role || (row.recipient_role === "admin" && role === "admin");
  }
  return role === "admin" || role === "operator";
}

export async function loadStaffReadNotificationIds(
  admin: SupabaseClient,
  userId: string,
): Promise<Set<string>> {
  try {
    const { data, error } = await admin
      .from("notification_reads")
      .select("notification_id")
      .eq("user_id", userId);

    if (error) {
      if (error.message.toLowerCase().includes("notification_reads")) return new Set();
      return new Set();
    }

    return new Set((data ?? []).map((r) => String((r as { notification_id: string }).notification_id)));
  } catch {
    return new Set();
  }
}

export function isNotificationUnreadForStaff(
  row: NotifRow & { type?: string },
  userId: string,
  role: UserRole,
  readIds: Set<string>,
): boolean {
  if (row.type === "chat_reply") return false;
  if (!matchesRecipient(row, userId, role)) return false;

  if (row.recipient_user_id === userId && !isStaffInboxNotification(row)) {
    return !row.is_read;
  }

  return !readIds.has(row.id) && !row.is_read;
}

export async function countStaffUnreadNotifications(
  admin: SupabaseClient,
  params: {
    userId: string;
    role: UserRole;
    siteSlug: "gpt-store" | "subs-store";
  },
): Promise<number> {
  const siteId = await getSiteUUID(params.siteSlug);
  const readIds = await loadStaffReadNotificationIds(admin, params.userId);

  let q = admin
    .from("notifications")
    .select("id, recipient_user_id, recipient_role, is_read, type");

  if (params.siteSlug === "gpt-store" && siteId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    q = (q as any).or(`site_id.eq.${siteId},site_id.is.null`) as typeof q;
  }

  const { data, error } = await q;
  if (error) return 0;

  return (data ?? []).filter((row) =>
    isNotificationUnreadForStaff(row as NotifRow, params.userId, params.role, readIds),
  ).length;
}

/** Пометить уведомление прочитанным для текущего staff-пользователя. */
export async function markStaffNotificationRead(
  admin: SupabaseClient,
  params: { notificationId: string; userId: string; role?: UserRole; email?: string | null },
): Promise<void> {
  if (params.role) {
    await ensureStaffProfileForReads(admin, {
      userId: params.userId,
      email: params.email,
      role: params.role,
    });
  }

  const { data: row } = await admin
    .from("notifications")
    .select("id, recipient_user_id, type")
    .eq("id", params.notificationId)
    .maybeSingle();

  if (!row) return;

  const typed = row as { id: string; recipient_user_id: string | null; type?: string };
  const staffInbox = isStaffInboxNotification(typed);

  if (typed.recipient_user_id === params.userId && !staffInbox) {
    await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", params.notificationId)
      .eq("recipient_user_id", params.userId);
    return;
  }

  const { error } = await admin.from("notification_reads").upsert(
    {
      notification_id: params.notificationId,
      user_id: params.userId,
      read_at: new Date().toISOString(),
    },
    { onConflict: "notification_id,user_id" },
  );
  if (error) {
    const msg = error.message ?? "";
    if (msg.toLowerCase().includes("notification_reads")) {
      await admin.from("notifications").update({ is_read: true }).eq("id", params.notificationId);
      return;
    }
    console.error("[markStaffNotificationRead]", msg);
    return;
  }

  if (staffInbox || !typed.recipient_user_id) {
    await admin.from("notifications").update({ is_read: true }).eq("id", params.notificationId);
  }
}

export type MarkAllStaffNotificationsResult = {
  ok: boolean;
  marked: number;
  error?: string;
};

/**
 * Пометить все непрочитанные staff-уведомления для текущего пользователя на сайте.
 * Та же логика, что GET / unread badge: broadcast → notification_reads, личные → is_read.
 */
export async function markAllStaffNotificationsReadForUser(
  admin: SupabaseClient,
  params: {
    userId: string;
    role: UserRole;
    siteSlug: "gpt-store" | "subs-store";
    email?: string | null;
  },
): Promise<MarkAllStaffNotificationsResult> {
  await ensureStaffProfileForReads(admin, {
    userId: params.userId,
    email: params.email,
    role: params.role,
  });

  const siteId = await getSiteUUID(params.siteSlug);
  const readIds = await loadStaffReadNotificationIds(admin, params.userId);
  const now = new Date().toISOString();

  let q = admin
    .from("notifications")
    .select("id, recipient_user_id, recipient_role, is_read, type");

  if (params.siteSlug === "gpt-store" && siteId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    q = (q as any).or(`site_id.eq.${siteId},site_id.is.null`) as typeof q;
  }

  const { data, error: loadErr } = await q;
  if (loadErr) {
    return { ok: false, marked: 0, error: loadErr.message };
  }

  const rows = (data ?? []) as (NotifRow & { type?: string })[];
  const forReadsTable: string[] = [];
  const forGlobalRead: string[] = [];

  for (const row of rows) {
    if (row.type === "chat_reply") continue;
    if (!matchesRecipient(row, params.userId, params.role)) continue;
    if (!isNotificationUnreadForStaff(row, params.userId, params.role, readIds)) continue;

    if (row.recipient_user_id === params.userId && !isStaffInboxNotification(row)) {
      forGlobalRead.push(row.id);
    } else {
      forReadsTable.push(row.id);
    }
  }

  const CHUNK = 80;

  for (let i = 0; i < forReadsTable.length; i += CHUNK) {
    const chunk = forReadsTable.slice(i, i + CHUNK);
    const { error: readsErr } = await admin.from("notification_reads").upsert(
      chunk.map((notification_id) => ({
        notification_id,
        user_id: params.userId,
        read_at: now,
      })),
      { onConflict: "notification_id,user_id" },
    );
    if (readsErr) {
      const msg = readsErr.message ?? "notification_reads upsert failed";
      if (msg.toLowerCase().includes("notification_reads")) {
        await admin.from("notifications").update({ is_read: true }).in("id", chunk);
        continue;
      }
      console.error("[markAllStaffNotificationsReadForUser]", msg);
      return { ok: false, marked: 0, error: msg };
    }
  }

  if (forReadsTable.length) {
    for (let i = 0; i < forReadsTable.length; i += CHUNK) {
      const chunk = forReadsTable.slice(i, i + CHUNK);
      const { error: updErr } = await admin.from("notifications").update({ is_read: true }).in("id", chunk);
      if (updErr) {
        return { ok: false, marked: 0, error: updErr.message };
      }
    }
  }

  if (forGlobalRead.length) {
    for (let i = 0; i < forGlobalRead.length; i += CHUNK) {
      const chunk = forGlobalRead.slice(i, i + CHUNK);
      const { error: updErr } = await admin
        .from("notifications")
        .update({ is_read: true })
        .in("id", chunk);
      if (updErr) {
        return { ok: false, marked: 0, error: updErr.message };
      }
    }
  }

  return { ok: true, marked: forReadsTable.length + forGlobalRead.length };
}

/** @deprecated Используйте markAllStaffNotificationsReadForUser */
export async function markAllStaffBroadcastNotificationsRead(
  admin: SupabaseClient,
  params: { userId: string; siteSlug: "gpt-store" | "subs-store" },
): Promise<void> {
  await markAllStaffNotificationsReadForUser(admin, {
    userId: params.userId,
    role: "admin",
    siteSlug: params.siteSlug,
  });
}
