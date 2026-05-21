import { NextRequest, NextResponse } from "next/server";

import { resolveServerRole } from "@/lib/auth/server-role";
import { getOrCreateClientOperatorSession, pickBestOperatorSessionForUser } from "@/lib/chat/operatorSession";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSiteUUID } from "@/lib/admin/getSiteId";
import type { Database } from "@/types/database";
import type { ChatRoomListItem } from "@/types/chat-ui";

type SessionRow = Database["public"]["Tables"]["chat_sessions"]["Row"];

async function handleRooms(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  const list = req.nextUrl.searchParams.get("list") === "1";

  if (list) {
    if (role !== "admin" && role !== "operator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();

    const { data: clients, error: clientsErr } = await admin
      .from("profiles")
      .select("id, email, username")
      .eq("role", "client")
      .order("created_at", { ascending: false })
      .limit(500);

    if (clientsErr) {
      return NextResponse.json({ error: "Не удалось загрузить клиентов" }, { status: 500 });
    }

    const clientRows = clients ?? [];
    if (clientRows.length === 0) {
      return NextResponse.json([] as ChatRoomListItem[]);
    }

    const clientIds = clientRows.map((c) => c.id);

    // Site filter: only show sessions for the selected site
    // chat_sessions.site_id is a UUID FK (migration 005) — must use UUID, not slug
    const siteParam = req.nextUrl.searchParams.get("site");
    const siteId = siteParam ? await getSiteUUID(siteParam) : null;

    let sessionsQuery = admin
      .from("chat_sessions")
      .select("id, user_id, site_id, type, status, staff_peer_id, first_message_at, last_operator_reply_at, created_at, updated_at")
      .eq("type", "operator")
      .in("user_id", clientIds)
      .order("created_at", { ascending: false });

    if (siteId) {
      if (siteParam === "gpt-store") {
        // GPT STORE: include sessions with gpt-store UUID or legacy null site_id
        sessionsQuery = sessionsQuery.or(`site_id.eq.${siteId},site_id.is.null`);
      } else {
        sessionsQuery = sessionsQuery.eq("site_id", siteId);
      }
    }

    const { data: sessions, error: sesErr } = await sessionsQuery;

    if (sesErr) {
      return NextResponse.json({ error: "Не удалось загрузить сессии" }, { status: 500 });
    }

    const sessionsByUser = new Map<string, SessionRow[]>();
    for (const s of sessions ?? []) {
      if (!s.user_id) continue;
      const arr = sessionsByUser.get(s.user_id) ?? [];
      arr.push(s);
      sessionsByUser.set(s.user_id, arr);
    }

    const sessionIds = (sessions ?? []).map((s) => s.id).filter(Boolean);
    const lastAtBySession = new Map<string, string>();
    const unreadBySession = new Map<string, number>();

    if (sessionIds.length) {
      const { data: lastMsgs } = await admin
        .from("chat_messages")
        .select("session_id, created_at")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false });

      for (const m of lastMsgs ?? []) {
        if (!lastAtBySession.has(m.session_id)) {
          lastAtBySession.set(m.session_id, m.created_at);
        }
      }

      const { data: unreadRows } = await admin
        .from("chat_messages")
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("sender_type", "client")
        .eq("is_read", false);

      for (const u of unreadRows ?? []) {
        unreadBySession.set(u.session_id, (unreadBySession.get(u.session_id) ?? 0) + 1);
      }
    }

    // Показываем только тех клиентов, у кого уже есть operator-сессия.
    // Это исключает "пустые" карточки без реального диалога.
    const activeClientRows = clientRows.filter((c) => (sessionsByUser.get(c.id)?.length ?? 0) > 0);

    const result: ChatRoomListItem[] = activeClientRows.map((c) => {
      const candidates = sessionsByUser.get(c.id) ?? [];
      const s =
        candidates.length === 0
          ? null
          : candidates.length === 1
            ? candidates[0]
            : pickBestOperatorSessionForUser(candidates, lastAtBySession);
      const lastAt = s ? lastAtBySession.get(s.id) ?? null : null;

      let uiStatus: ChatRoomListItem["status"] = "open";
      if (!s) uiStatus = "open";
      else if (s.status === "closed") uiStatus = "closed";
      else if (s.first_message_at && !s.last_operator_reply_at) uiStatus = "waiting";
      else uiStatus = "open";

      return {
        id: s?.id ?? null,
        client_id: c.id,
        status: uiStatus,
        last_message_at: lastAt,
        last_message_preview: null,
        unread_operator: s ? unreadBySession.get(s.id) ?? 0 : 0,
        client: {
          full_name: c.username ?? null,
          email: c.email ?? null,
        },
      };
    });

    return NextResponse.json(result);
  }

  if (role === "admin" || role === "operator") {
    return NextResponse.json(
      { error: "Для списка чатов используйте ?list=1" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  // Pass site context so the session is tagged with the correct site_id
  const clientSiteParam = req.nextUrl.searchParams.get("site") ?? undefined;
  const session = await getOrCreateClientOperatorSession(admin, user.id, clientSiteParam);
  if (!session) {
    return NextResponse.json({ error: "Не удалось создать чат" }, { status: 500 });
  }

  const { data: lastMsg } = await admin
    .from("chat_messages")
    .select("created_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    id: session.id,
    status: session.status,
    last_message_at: lastMsg?.created_at ?? null,
  });
}

export async function GET(req: NextRequest) {
  return handleRooms(req);
}

export async function POST(req: NextRequest) {
  return handleRooms(req);
}
