import type { SupabaseClient } from "@supabase/supabase-js";

import { getSiteUUID } from "@/lib/admin/getSiteId";

/** Непрочитанные staff-уведомления (как на странице /admin/notifications, без chat_reply). */
export async function countGptStoreUnreadNotifications(
  admin: SupabaseClient,
  siteSlug: "gpt-store" | "subs-store" = "gpt-store",
): Promise<number> {
  const siteId = await getSiteUUID(siteSlug);

  let q = admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false)
    .neq("type", "chat_reply");

  if (siteId) {
    if (siteSlug === "gpt-store") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      q = (q as any).or(`site_id.eq.${siteId},site_id.is.null`) as typeof q;
    } else {
      q = q.eq("site_id", siteId);
    }
  }

  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

export async function countSubsStoreUnreadNotifications(subs: SupabaseClient): Promise<number> {
  const { count, error } = await subs
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false)
    .neq("type", "chat_reply");

  if (error) return 0;
  return count ?? 0;
}
