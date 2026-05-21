import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

type SessionRow = Database["public"]["Tables"]["chat_sessions"]["Row"];

/** Resolve site UUID from slug using the admin client (for UUID FK columns). */
async function resolveSiteId(admin: Admin, siteSlug: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin.from("sites") as any)
      .select("id")
      .eq("slug", siteSlug)
      .maybeSingle();
    return (data as { id?: string } | null)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * При нескольких сессиях support на одного клиента выбираем ту, где последнее сообщение новее
 * (иначе оператор и клиент могли смотреть разные session_id).
 * siteSlug фильтрует сессии по магазину.
 */
export async function pickCanonicalOperatorSession(
  admin: Admin,
  userId: string,
  siteSlug?: string
): Promise<{ id: string; status: "open" | "closed" } | null> {
  let q = admin
    .from("chat_sessions")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .eq("type", "operator")
    .order("created_at", { ascending: false });

  // Filter by site_id UUID when siteSlug is provided (migration 005+)
  // chat_sessions.site_id is a UUID FK — must use UUID, not slug string
  if (siteSlug) {
    const siteId = await resolveSiteId(admin, siteSlug);
    if (siteId) {
      q = q.eq("site_id", siteId);
    }
    // If siteId not resolved (sites table missing), skip site filter for resilience
  }

  const { data: sessions, error } = await q;

  if (error || !sessions?.length) return null;

  if (sessions.length === 1) {
    const s = sessions[0];
    return { id: s.id, status: s.status === "closed" ? "closed" : "open" };
  }

  const ids = sessions.map((s) => s.id);
  const { data: msgs } = await admin
    .from("chat_messages")
    .select("session_id, created_at")
    .in("session_id", ids)
    .order("created_at", { ascending: false });

  const lastAt = new Map<string, string>();
  for (const m of msgs ?? []) {
    if (!lastAt.has(m.session_id)) lastAt.set(m.session_id, m.created_at);
  }

  let best = sessions[0];
  let bestTime = lastAt.get(best.id) ?? "";
  for (let i = 1; i < sessions.length; i++) {
    const s = sessions[i];
    const t = lastAt.get(s.id) ?? "";
    if (t > bestTime) {
      best = s;
      bestTime = t;
    } else if (t === bestTime && new Date(s.created_at) > new Date(best.created_at)) {
      best = s;
    }
  }

  return { id: best.id, status: best.status === "closed" ? "closed" : "open" };
}

/**
 * Возвращает активную сессию чата с поддержкой для клиента (или создаёт новую).
 * siteSlug используется для изоляции чатов разных магазинов.
 */
export async function getOrCreateClientOperatorSession(
  admin: Admin,
  userId: string,
  siteSlug?: string
): Promise<{ id: string; status: "open" | "closed" } | null> {
  // Resolve UUID once for all operations below
  const siteId = siteSlug ? await resolveSiteId(admin, siteSlug) : null;

  let activeSession = await pickCanonicalOperatorSession(admin, userId, siteSlug);

  if (activeSession?.id && activeSession.status !== "open") {
    await admin.from("chat_sessions").update({ status: "open" }).eq("id", activeSession.id);
    activeSession = { ...activeSession, status: "open" };
  }

  if (!activeSession?.id) {
    type ChatSessionInsert = Database["public"]["Tables"]["chat_sessions"]["Insert"];
    // site_id must be UUID (not slug string) for the UUID FK column
    const basePayload: ChatSessionInsert = {
      user_id: userId,
      type: "operator",
      status: "open",
      ...(siteId ? { site_id: siteId } : {}),
    };

    let { data: created } = await admin
      .from("chat_sessions")
      .insert(basePayload)
      .select("id, status")
      .single();

    if (!created?.id) {
      const fallbackPayload: ChatSessionInsert = {
        user_id: null,
        type: "operator",
        status: "open",
        ...(siteId ? { site_id: siteId } : {}),
      };
      const fallback = await admin
        .from("chat_sessions")
        .insert(fallbackPayload)
        .select("id, status")
        .single();
      created = fallback.data ?? null;
    }

    activeSession = created?.id
      ? { id: created.id, status: created.status === "closed" ? "closed" : "open" }
      : null;
  }

  if (activeSession?.id) {
    const { data: s } = await admin
      .from("chat_sessions")
      .select("user_id")
      .eq("id", activeSession.id)
      .maybeSingle();
    if (s && (s.user_id === null || s.user_id === userId)) {
      await admin.from("chat_sessions").update({ user_id: userId }).eq("id", activeSession.id);
    }
  }

  return activeSession?.id
    ? { id: activeSession.id, status: activeSession.status === "closed" ? "closed" : "open" }
    : null;
}

/** Лучшая сессия из списка строк (для списка комнат без N+1 к БД). */
export function pickBestOperatorSessionForUser(
  rows: SessionRow[],
  lastMessageAtBySession: Map<string, string>
): SessionRow | null {
  const list = rows.filter((r) => r.user_id && r.type === "operator");
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];

  let best = list[0];
  let bestAt = lastMessageAtBySession.get(best.id) ?? "";
  for (let i = 1; i < list.length; i++) {
    const s = list[i];
    const at = lastMessageAtBySession.get(s.id) ?? "";
    if (at > bestAt) {
      best = s;
      bestAt = at;
    } else if (at === bestAt && new Date(s.created_at) > new Date(best.created_at)) {
      best = s;
    }
  }
  return best;
}
