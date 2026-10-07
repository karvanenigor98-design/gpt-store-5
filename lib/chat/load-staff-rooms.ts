import { getSiteUUID } from "@/lib/admin/getSiteId";
import { sortStaffChatRooms } from "@/lib/chat/sort-staff-rooms";
import { pickBestOperatorSessionForUser } from "@/lib/chat/operatorSession";
import type { Database } from "@/types/database";
import type { ChatRoomListItem } from "@/types/chat-ui";
import type { SupabaseClient } from "@supabase/supabase-js";

type SessionRow = Database["public"]["Tables"]["chat_sessions"]["Row"];

type ProfileLite = {
  id: string;
  email: string | null;
  username: string | null;
  telegram_username: string | null;
  telegram_id: number | null;
};

async function fetchInChunks<T>(
  ids: string[],
  size: number,
  fn: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size);
    if (!chunk.length) continue;
    out.push(...(await fn(chunk)));
  }
  return out;
}

export async function loadGptStaffChatRooms(
  admin: SupabaseClient,
  params: { siteParam: string | null; search: string },
): Promise<ChatRoomListItem[]> {
  const search = params.search.trim().toLocaleLowerCase("ru");
  const siteParam = params.siteParam;
  const siteId = siteParam ? await getSiteUUID(siteParam) : null;

  let sessionsQuery = admin
    .from("chat_sessions")
    .select(
      "id, user_id, site_id, type, status, staff_peer_id, first_message_at, last_operator_reply_at, last_message_at, created_at, updated_at",
    )
    .eq("type", "operator")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(250);

  if (siteId) {
    sessionsQuery =
      siteParam === "gpt-store"
        ? sessionsQuery.or(`site_id.eq.${siteId},site_id.is.null`)
        : sessionsQuery.eq("site_id", siteId);
  }

  let { data: sessions, error: sesErr } = await sessionsQuery;

  if (sesErr?.message?.includes("last_message_at")) {
    let fallback = admin
      .from("chat_sessions")
      .select(
        "id, user_id, site_id, type, status, staff_peer_id, first_message_at, last_operator_reply_at, created_at, updated_at",
      )
      .eq("type", "operator")
      .order("created_at", { ascending: false })
      .limit(250);
    if (siteId) {
      fallback =
        siteParam === "gpt-store"
          ? fallback.or(`site_id.eq.${siteId},site_id.is.null`)
          : fallback.eq("site_id", siteId);
    }
    const fb = await fallback;
    sesErr = fb.error;
    sessions = (fb.data ?? []).map((row) => ({ ...row, last_message_at: null }));
  }

  if (sesErr) {
    throw new Error(sesErr.message);
  }

  const sessionRows = (sessions ?? []) as SessionRow[];
  if (!sessionRows.length) return [];

  const userIds = [...new Set(sessionRows.map((s) => s.user_id).filter(Boolean))] as string[];

  const profileRows = userIds.length
    ? await fetchInChunks(userIds, 80, async (chunk) => {
        let { data, error } = await admin
          .from("profiles")
          .select("id, email, username, telegram_username, telegram_id")
          .in("id", chunk);
        if (error?.message?.includes("telegram_")) {
          const fb = await admin.from("profiles").select("id, email, username").in("id", chunk);
          return (fb.data ?? []).map((row) => ({
            ...row,
            telegram_username: null,
            telegram_id: null,
          })) as ProfileLite[];
        }
        return (data ?? []) as ProfileLite[];
      })
    : [];

  const profileById = new Map(profileRows.map((p) => [p.id, p]));

  const sessionsByUser = new Map<string, SessionRow[]>();
  const guestSessions: SessionRow[] = [];
  for (const s of sessionRows) {
    if (!s.user_id) {
      guestSessions.push(s);
      continue;
    }
    const arr = sessionsByUser.get(s.user_id) ?? [];
    arr.push(s);
    sessionsByUser.set(s.user_id, arr);
  }

  const lastAtBySession = new Map<string, string>();
  const lastPreviewBySession = new Map<string, string>();
  const unreadBySession = new Map<string, number>();
  const searchMatchSessionIds = new Set<string>();

  for (const s of sessionRows) {
    const lastAt = (s as { last_message_at?: string | null }).last_message_at;
    if (lastAt) lastAtBySession.set(s.id, lastAt);
  }

  const sessionIds = sessionRows.map((s) => s.id);
  const previewIds = sessionIds.slice(0, 80);

  try {
    await Promise.race([
      (async () => {
        const lastMsgs = await fetchInChunks(previewIds, 40, async (chunk) => {
          const { data } = await admin
            .from("chat_messages")
            .select("session_id, created_at, content")
            .in("session_id", chunk)
            .order("created_at", { ascending: false })
            .limit(Math.min(chunk.length * 3, 120));
          return data ?? [];
        });

        for (const m of lastMsgs) {
          if (!lastAtBySession.has(m.session_id)) {
            lastAtBySession.set(m.session_id, m.created_at);
          }
          if (!lastPreviewBySession.has(m.session_id)) {
            const content = m.content ?? "";
            lastPreviewBySession.set(m.session_id, content.length > 80 ? `${content.slice(0, 80)}…` : content);
          }
          if (search && (m.content ?? "").toLocaleLowerCase("ru").includes(search)) {
            searchMatchSessionIds.add(m.session_id);
          }
        }

        const unreadRows = await fetchInChunks(previewIds, 40, async (chunk) => {
          const { data } = await admin
            .from("chat_messages")
            .select("session_id")
            .in("session_id", chunk)
            .eq("sender_type", "client")
            .eq("is_read", false)
            .limit(400);
          return data ?? [];
        });
        for (const u of unreadRows) {
          unreadBySession.set(u.session_id, (unreadBySession.get(u.session_id) ?? 0) + 1);
        }
      })(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("preview_timeout")), 4500);
      }),
    ]);
  } catch {
    // Список диалогов важнее превью/unread.
  }

  function toRoom(s: SessionRow | null, clientId: string, profile: ProfileLite | null, guestLabel?: string): ChatRoomListItem {
    let uiStatus: ChatRoomListItem["status"] = "open";
    if (!s) uiStatus = "open";
    else if (s.status === "closed") uiStatus = "closed";
    else if (s.first_message_at && !s.last_operator_reply_at) uiStatus = "waiting";
    else uiStatus = "open";

    return {
      id: s?.id ?? null,
      client_id: clientId,
      status: uiStatus,
      last_message_at: s ? lastAtBySession.get(s.id) ?? null : null,
      last_message_preview: s ? lastPreviewBySession.get(s.id) ?? null : null,
      unread_operator: s ? unreadBySession.get(s.id) ?? 0 : 0,
      client: {
        full_name: profile?.username ?? guestLabel ?? null,
        email: profile?.email ?? (guestLabel ? "Гость" : null),
        telegram_username: profile?.telegram_username ?? null,
        telegram_id: profile?.telegram_id ?? null,
      },
    };
  }

  const result: ChatRoomListItem[] = [];

  for (const [userId, candidates] of sessionsByUser) {
    const s =
      (candidates.length === 1
        ? candidates[0]
        : pickBestOperatorSessionForUser(candidates, lastAtBySession)) ?? candidates[0] ?? null;
    result.push(toRoom(s, userId, profileById.get(userId) ?? null));
  }

  for (const s of guestSessions) {
    result.push(toRoom(s, `guest:${s.id}`, null, "Гость"));
  }

  const filtered = search
    ? result.filter((room) => {
        const tg = room.client.telegram_username ?? "";
        const tgId = String(room.client.telegram_id ?? "");
        const searchNorm = search.replace(/^@+/, "");
        const haystack =
          `${room.client.email ?? ""} ${room.client.full_name ?? ""} ${room.client_id} ${room.id ?? ""} @${tg} ${tg} ${tgId}`
            .toLocaleLowerCase("ru");
        return (
          haystack.includes(search) ||
          haystack.includes(searchNorm) ||
          (room.id ? searchMatchSessionIds.has(room.id) : false)
        );
      })
    : result;

  return sortStaffChatRooms(filtered);
}
