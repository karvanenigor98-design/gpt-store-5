import type { SupabaseClient } from "@supabase/supabase-js";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { pickBestOperatorSessionForUser } from "@/lib/chat/operatorSession";
import type { Database } from "@/types/database";

type SessionRow = Database["public"]["Tables"]["chat_sessions"]["Row"];

/** Fallback when RPC is missing: canonical sessions then count (bounded). */
async function listCanonicalGptOperatorSessionIds(
  admin: SupabaseClient,
  siteSlug: "gpt-store" | "subs-store" = "gpt-store",
): Promise<string[]> {
  const siteId = await getSiteUUID(siteSlug);
  const subsSiteId = siteSlug === "gpt-store" ? await getSiteUUID("subs-store") : null;

  let sessionsQ = admin
    .from("chat_sessions")
    .select("id,user_id,type,status,created_at,site_id,last_message_at")
    .eq("type", "operator")
    .eq("status", "open")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(400);

  if (siteId) {
    if (siteSlug === "gpt-store") {
      sessionsQ = sessionsQ.or(`site_id.eq.${siteId},site_id.is.null`);
    } else {
      sessionsQ = sessionsQ.eq("site_id", siteId);
    }
  }

  const { data: sessions, error: sesErr } = await sessionsQ;
  if (sesErr || !sessions?.length) return [];

  const filtered = (sessions as SessionRow[]).filter((s) => {
    if (siteSlug !== "gpt-store" || !subsSiteId || !s.site_id) return true;
    return s.site_id !== subsSiteId;
  });

  const sessionIds = filtered.filter((s) => s.user_id).map((s) => s.id).filter(Boolean);
  if (!sessionIds.length) return [];

  const sessionsPerUser = new Map<string, number>();
  let hasDuplicates = false;
  for (const session of filtered) {
    if (!session.user_id) continue;
    const count = (sessionsPerUser.get(session.user_id) ?? 0) + 1;
    sessionsPerUser.set(session.user_id, count);
    if (count > 1) hasDuplicates = true;
  }
  if (!hasDuplicates) return sessionIds;

  const lastAtBySession = new Map<string, string>();
  for (const s of filtered) {
    const at = (s as { last_message_at?: string | null }).last_message_at;
    if (at) lastAtBySession.set(s.id, at);
  }

  const byUser = new Map<string, SessionRow[]>();
  for (const s of filtered) {
    if (!s.user_id) continue;
    const arr = byUser.get(s.user_id) ?? [];
    arr.push(s);
    byUser.set(s.user_id, arr);
  }

  const canonicalIds: string[] = [];
  for (const rows of byUser.values()) {
    const best = pickBestOperatorSessionForUser(rows, lastAtBySession);
    if (best?.id) canonicalIds.push(best.id);
  }

  return canonicalIds;
}

/** Непрочитанные сообщения клиентов в канонических operator-чатах (GPT DB). */
export async function countGptStoreUnreadClientMessages(
  admin: SupabaseClient,
  siteSlug: "gpt-store" | "subs-store" = "gpt-store",
): Promise<number> {
  const siteId = await getSiteUUID(siteSlug);
  const excludeSiteId =
    siteSlug === "gpt-store" ? await getSiteUUID("subs-store") : null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc(
      "count_gpt_unread_client_chat_messages",
      {
        p_site_id: siteId,
        p_exclude_site_id: excludeSiteId,
      },
    );
    if (!error && typeof data === "number") return data;
    if (!error && data != null) return Number(data) || 0;
  } catch {
    /* RPC missing — fallback */
  }

  const sessionIds = await listCanonicalGptOperatorSessionIds(admin, siteSlug);
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

/** Непрочитанные сообщения клиентов в активных тредах Subs Store. */
export async function countSubsStoreUnreadClientMessages(subs: SupabaseClient): Promise<number> {
  const { data: threads, error: tErr } = await subs
    .from("chat_threads")
    .select("id")
    .eq("status", "open")
    .limit(200);
  if (tErr) return 0;

  const threadIds = (threads ?? []).map((t) => t.id as string).filter(Boolean);
  if (!threadIds.length) return 0;

  const { count, error } = await subs
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .in("thread_id", threadIds)
    .eq("author_role", "customer")
    .is("read_at", null);

  if (error) return 0;
  return count ?? 0;
}
