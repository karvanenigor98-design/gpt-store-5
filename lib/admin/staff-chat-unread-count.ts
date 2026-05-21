import type { SupabaseClient } from "@supabase/supabase-js";

import { getSiteUUID } from "@/lib/admin/getSiteId";

/** Все непрочитанные сообщения клиентов в operator-чатах выбранного магазина (GPT DB). */
export async function countGptStoreUnreadClientMessages(
  admin: SupabaseClient,
  siteSlug: "gpt-store" | "subs-store" = "gpt-store",
): Promise<number> {
  const siteId = await getSiteUUID(siteSlug);

  let sessionsQ = admin.from("chat_sessions").select("id").eq("type", "operator");
  if (siteId) {
    if (siteSlug === "gpt-store") {
      sessionsQ = sessionsQ.or(`site_id.eq.${siteId},site_id.is.null`);
    } else {
      sessionsQ = sessionsQ.eq("site_id", siteId);
    }
  }

  const { data: sessions, error: sesErr } = await sessionsQ;
  if (sesErr) return 0;

  const sessionIds = (sessions ?? []).map((s) => s.id as string).filter(Boolean);
  if (!sessionIds.length) return 0;

  const { count, error: msgErr } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds)
    .eq("sender_type", "client")
    .eq("is_read", false);

  if (msgErr) return 0;
  return count ?? 0;
}

/** Все непрочитанные сообщения клиентов в Subs Store. */
export async function countSubsStoreUnreadClientMessages(subs: SupabaseClient): Promise<number> {
  const { count, error } = await subs
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("author_role", "customer")
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}
