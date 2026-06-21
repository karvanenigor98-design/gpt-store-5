import type { SupabaseClient } from "@supabase/supabase-js";



import { getSiteUUID } from "@/lib/admin/getSiteId";

import type { UserRole } from "@/types/database";



const UNREAD_SCAN_PAGE_SIZE = 500;
const UNREAD_SCAN_MAX_ROWS = 10_000;
// Backward-compat for internal verification scripts.
const MARK_ALL_CANDIDATE_LIMIT = UNREAD_SCAN_PAGE_SIZE;

const CHUNK = 80;



type NotifRow = {

  id: string;

  recipient_user_id: string | null;

  recipient_role: string | null;

  is_read: boolean;

};

type RecipientMatchOptions = {
  sharedInboxUserId?: string | null;
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

function isClientNotification(row: { recipient_role?: string | null }): boolean {
  return row.recipient_role === "client";
}



function matchesRecipient(

  row: NotifRow & { type?: string },

  authUserId: string,

  role: UserRole,
  options?: RecipientMatchOptions,
): boolean {

  if (isClientNotification(row)) return false;

  if (row.recipient_user_id === authUserId) return true;

  if (row.recipient_user_id) {
    const sharedInboxUserId = options?.sharedInboxUserId?.trim() ?? null;
    if (
      sharedInboxUserId &&
      row.recipient_user_id === sharedInboxUserId &&
      isStaffInboxNotification(row)
    ) {
      return role === "admin" || role === "operator";
    }

    return false;

  }

  if (isStaffInboxNotification(row)) {

    return role === "admin" || role === "operator";

  }

  if (row.recipient_role) {

    return row.recipient_role === role || (row.recipient_role === "admin" && role === "admin");

  }

  return role === "admin" || role === "operator";

}



async function ensureStaffProfileForReads(

  admin: SupabaseClient,

  params: { userId: string; email?: string | null; role: UserRole },

): Promise<void> {

  const { data } = await admin.from("profiles").select("id").eq("id", params.userId).maybeSingle();

  if (data) return;



  const role = params.role === "admin" || params.role === "operator" ? params.role : "operator";

  const { error } = await admin.from("profiles").insert({

    id: params.userId,

    email: params.email ?? null,

    role,

  });

  if (error && !error.message.toLowerCase().includes("duplicate")) {

    console.warn("[ensureStaffProfileForReads]", error.message);

  }

}



/**

 * UUID для notification_reads (FK → profiles).

 * В Subs БД профиль staff может быть под другим id при том же email.

 */

export async function resolveStaffNotificationUserId(

  admin: SupabaseClient,

  params: { userId: string; email?: string | null; role: UserRole },

): Promise<string> {

  await ensureStaffProfileForReads(admin, params);



  const { data: byId } = await admin.from("profiles").select("id").eq("id", params.userId).maybeSingle();

  if (byId?.id) return params.userId;



  const email = params.email?.trim();

  if (email) {

    const { data: byEmail } = await admin

      .from("profiles")

      .select("id")

      .ilike("email", email)

      .limit(1)

      .maybeSingle();

    if (byEmail?.id) return String(byEmail.id);

  }



  return params.userId;

}



export async function loadStaffReadNotificationIds(

  admin: SupabaseClient,

  readsUserId: string,

): Promise<Set<string>> {

  try {

    const { data, error } = await admin

      .from("notification_reads")

      .select("notification_id")

      .eq("user_id", readsUserId);



    if (error) {

      if (error.message.toLowerCase().includes("notification_reads")) return new Set();

      console.warn("[loadStaffReadNotificationIds]", error.message);

      return new Set();

    }



    return new Set((data ?? []).map((r) => String((r as { notification_id: string }).notification_id)));

  } catch {

    return new Set();

  }

}



export function isNotificationUnreadForStaff(

  row: NotifRow & { type?: string },

  authUserId: string,

  role: UserRole,

  readIds: Set<string>,
  options?: RecipientMatchOptions,
): boolean {

  if (row.type === "chat_reply") return false;

  if (!matchesRecipient(row, authUserId, role, options)) return false;



  if (row.recipient_user_id === authUserId && !isStaffInboxNotification(row)) {

    return !row.is_read;

  }



  return !readIds.has(row.id);

}



async function loadUnreadCandidatesPage(

  admin: SupabaseClient,

  siteSlug: "gpt-store" | "subs-store",
  offset: number,
  limit: number,

): Promise<(NotifRow & { type?: string })[] | { error: string }> {

  const siteId = await getSiteUUID(siteSlug);



  let q = admin

    .from("notifications")

    .select("id, recipient_user_id, recipient_role, is_read, type")

    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);



  if (siteSlug === "gpt-store" && siteId) {
    const subsSiteId = await getSiteUUID("subs-store");
    const siteFilter = subsSiteId
      ? `site_id.eq.${siteId},site_id.eq.${subsSiteId},site_id.is.null`
      : `site_id.eq.${siteId},site_id.is.null`;
    q = q.or(siteFilter);
  }



  const { data, error } = await q;

  if (error) return { error: error.message };

  return (data ?? []) as (NotifRow & { type?: string })[];

}

async function loadAllUnreadCandidates(
  admin: SupabaseClient,
  siteSlug: "gpt-store" | "subs-store",
): Promise<(NotifRow & { type?: string })[] | { error: string }> {
  const rows: (NotifRow & { type?: string })[] = [];

  for (
    let offset = 0;
    offset < UNREAD_SCAN_MAX_ROWS;
    offset += MARK_ALL_CANDIDATE_LIMIT
  ) {
    const page = await loadUnreadCandidatesPage(
      admin,
      siteSlug,
      offset,
      MARK_ALL_CANDIDATE_LIMIT,
    );
    if ("error" in page) return page;
    rows.push(...page);
    if (page.length < MARK_ALL_CANDIDATE_LIMIT) break;
  }

  return rows;
}



async function updateIsReadChunks(admin: SupabaseClient, ids: string[]): Promise<string | null> {

  for (let i = 0; i < ids.length; i += CHUNK) {

    const chunk = ids.slice(i, i + CHUNK);

    const { error } = await admin.from("notifications").update({ is_read: true }).in("id", chunk);

    if (error) return error.message;

  }

  return null;

}



async function upsertReadChunks(

  admin: SupabaseClient,

  ids: string[],

  readsUserId: string,

  readAt: string,

): Promise<string | null> {

  for (let i = 0; i < ids.length; i += CHUNK) {

    const chunk = ids.slice(i, i + CHUNK);

    const { error } = await admin.from("notification_reads").upsert(

      chunk.map((notification_id) => ({

        notification_id,

        user_id: readsUserId,

        read_at: readAt,

      })),

      { onConflict: "notification_id,user_id" },

    );

    if (error) {

      console.warn("[upsertReadChunks]", error.message);

      return error.message;

    }

  }

  return null;

}



export async function countStaffUnreadNotifications(

  admin: SupabaseClient,

  params: {

    userId: string;

    role: UserRole;

    siteSlug: "gpt-store" | "subs-store";

    email?: string | null;

    sharedInboxUserId?: string | null;

  },

): Promise<number> {

  const readsUserId = await resolveStaffNotificationUserId(admin, {

    userId: params.userId,

    email: params.email,

    role: params.role,

  });

  const readIds = await loadStaffReadNotificationIds(admin, readsUserId);



  const loaded = await loadAllUnreadCandidates(admin, params.siteSlug);

  if ("error" in loaded) return 0;



  return loaded.filter((row) =>

    isNotificationUnreadForStaff(row, params.userId, params.role, readIds, {
      sharedInboxUserId: params.sharedInboxUserId,
    }),

  ).length;

}



/** Пометить уведомление прочитанным для текущего staff-пользователя. */

export async function markStaffNotificationRead(

  admin: SupabaseClient,

  params: {
    notificationId: string;
    userId: string;
    role?: UserRole;
    email?: string | null;
    sharedInboxUserId?: string | null;
  },

): Promise<void> {

  const role = params.role ?? "operator";

  const readsUserId = await resolveStaffNotificationUserId(admin, {

    userId: params.userId,

    email: params.email,

    role,

  });



  const { data: row } = await admin

    .from("notifications")

    .select("id, recipient_user_id, type, is_read")

    .eq("id", params.notificationId)

    .maybeSingle();



  if (!row) return;



  const typed = row as {
    id: string;
    recipient_user_id: string | null;
    recipient_role?: string | null;
    type?: string;
    is_read: boolean;
  };

  if (isClientNotification(typed)) return;

  const staffInbox = isStaffInboxNotification(typed);
  const sharedInboxUserId = params.sharedInboxUserId?.trim() ?? null;
  const isSharedInboxRow =
    Boolean(sharedInboxUserId) &&
    typed.recipient_user_id === sharedInboxUserId &&
    staffInbox;



  if (typed.recipient_user_id === params.userId && !staffInbox) {

    await admin

      .from("notifications")

      .update({ is_read: true })

      .eq("id", params.notificationId)

      .eq("recipient_user_id", params.userId);

    return;

  }

  if (typed.recipient_user_id && !isSharedInboxRow) {
    return;
  }

  const readAt = new Date().toISOString();

  await upsertReadChunks(admin, [params.notificationId], readsUserId, readAt);

}



export type MarkAllStaffNotificationsResult = {

  ok: boolean;

  marked: number;

  error?: string;

};



/**

 * Пометить все непрочитанные staff-уведомления для текущего пользователя на сайте.

 * Сначала is_read (надёжно), затем notification_reads (per-user).

 */

export async function markAllStaffNotificationsReadForUser(

  admin: SupabaseClient,

  params: {

    userId: string;

    role: UserRole;

    siteSlug: "gpt-store" | "subs-store";

    email?: string | null;

    sharedInboxUserId?: string | null;

  },

): Promise<MarkAllStaffNotificationsResult> {

  const readsUserId = await resolveStaffNotificationUserId(admin, {

    userId: params.userId,

    email: params.email,

    role: params.role,

  });

  const readIds = await loadStaffReadNotificationIds(admin, readsUserId);

  const now = new Date().toISOString();



  const loaded = await loadAllUnreadCandidates(admin, params.siteSlug);

  if ("error" in loaded) {

    return { ok: false, marked: 0, error: loaded.error };

  }



  const toMark: string[] = [];
  const personalIds: string[] = [];

  const forReadsTable: string[] = [];



  for (const row of loaded) {

    if (row.type === "chat_reply") continue;

    if (
      !matchesRecipient(row, params.userId, params.role, {
        sharedInboxUserId: params.sharedInboxUserId,
      })
    ) {
      continue;
    }

    if (
      !isNotificationUnreadForStaff(row, params.userId, params.role, readIds, {
        sharedInboxUserId: params.sharedInboxUserId,
      })
    ) {
      continue;
    }



    toMark.push(row.id);
    if (row.recipient_user_id === params.userId && !isStaffInboxNotification(row)) {
      personalIds.push(row.id);
    }

    if (row.recipient_user_id !== params.userId || isStaffInboxNotification(row)) {
      forReadsTable.push(row.id);
    }

  }



  if (!toMark.length) {

    return { ok: true, marked: 0 };

  }



  // Глобальный is_read обновляем только для персональных записей текущего staff.
  if (personalIds.length) {
    const isReadErr = await updateIsReadChunks(admin, personalIds);
    if (isReadErr) {
      return { ok: false, marked: 0, error: isReadErr };
    }
  }



  if (forReadsTable.length) {

    await upsertReadChunks(admin, forReadsTable, readsUserId, now);

  }



  return { ok: true, marked: toMark.length };

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


