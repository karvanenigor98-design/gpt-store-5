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
    const search = req.nextUrl.searchParams.get("q")?.trim().toLocaleLowerCase("ru") ?? "";

    let { data: clients, error: clientsErr } = await admin
      .from("profiles")
      .select("id, email, username, telegram_username, telegram_id")
      .eq("role", "client")
      .order("created_at", { ascending: false })
      .limit(500);

    if (clientsErr?.message?.includes("telegram_")) {
      const fallback = await admin
        .from("profiles")
        .select("id, email, username")
        .eq("role", "client")
        .order("created_at", { ascending: false })
        .limit(500);
      clients = (fallback.data ?? []).map((row) => ({
        ...row,
        telegram_username: null,
        telegram_id: null,
      }));
      clientsErr = fallback.error;
    }

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
      .select("id, user_id, site_id, type, status, staff_peer_id, first_message_at, last_operator_reply_at, last_message_at, created_at, updated_at")
      .eq("type", "operator")
      .in("user_id", clientIds)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (siteId) {
      if (siteParam === "gpt-store") {
        // GPT STORE: include sessions with gpt-store UUID or legacy null site_id
        sessionsQuery = sessionsQuery.or(`site_id.eq.${siteId},site_id.is.null`);
      } else {
        sessionsQuery = sessionsQuery.eq("site_id", siteId);
      }
    }

    let { data: sessions, error: sesErr } = await sessionsQuery;

    // Pre-migration fallback: column last_message_at may be missing.
    if (sesErr?.message?.includes("last_message_at")) {
      const fallback = admin
        .from("chat_sessions")
        .select("id, user_id, site_id, type, status, staff_peer_id, first_message_at, last_operator_reply_at, created_at, updated_at")
        .eq("type", "operator")
        .in("user_id", clientIds)
        .order("created_at", { ascending: false });
      const scoped =
        siteId && siteParam === "gpt-store"
          ? fallback.or(`site_id.eq.${siteId},site_id.is.null`)
          : siteId
            ? fallback.eq("site_id", siteId)
            : fallback;
      const fb = await scoped;
      sesErr = fb.error;
      sessions = (fb.data ?? []).map((row) => ({
        ...row,
        last_message_at: null,
      }));
    }

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
    const lastPreviewBySession = new Map<string, string>();
    const unreadBySession = new Map<string, number>();
    const searchMatchSessionIds = new Set<string>();

    if (sessionIds.length) {
      for (const s of sessions ?? []) {
        const lastAt = (s as { last_message_at?: string | null }).last_message_at;
        if (lastAt) lastAtBySession.set(s.id, lastAt);
      }

      // Bounded recent window for preview + search (avoid unbounded full-table scan).
      const { data: lastMsgs } = await admin
        .from("chat_messages")
        .select("session_id, created_at, content")
        .in("session_id", sessionIds)
        .order("created_at", { ascending: false })
        .limit(Math.min(sessionIds.length * 3, 1500));

      for (const m of lastMsgs ?? []) {
        if (!lastAtBySession.has(m.session_id)) {
          lastAtBySession.set(m.session_id, m.created_at);
        }
        if (!lastPreviewBySession.has(m.session_id)) {
          const content = m.content ?? "";
          lastPreviewBySession.set(
            m.session_id,
            content.length > 80 ? `${content.slice(0, 80)}…` : content,
          );
        }
        if (search && (m.content ?? "").toLocaleLowerCase("ru").includes(search)) {
          searchMatchSessionIds.add(m.session_id);
        }
      }

      if (search) {
        const { data: searchHits } = await admin
          .from("chat_messages")
          .select("session_id")
          .in("session_id", sessionIds)
          .ilike("content", `%${search}%`)
          .limit(200);
        for (const hit of searchHits ?? []) {
          searchMatchSessionIds.add(hit.session_id);
        }
      }

      const { data: unreadRows } = await admin
        .from("chat_messages")
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("sender_type", "client")
        .eq("is_read", false)
        .limit(5000);

      for (const u of unreadRows ?? []) {
        unreadBySession.set(u.session_id, (unreadBySession.get(u.session_id) ?? 0) + 1);
      }
    }

    // Показываем только тех клиентов, у кого уже есть operator-сессия.
    // Это исключает "пустые" карточки без реального диалога.
    const activeClientRows = clientRows.filter((c) => (sessionsByUser.get(c.id)?.length ?? 0) > 0);

    // Order ids linked to these clients (for search by order UUID).
    const orderIdByClient = new Map<string, string[]>();
    if (search && activeClientRows.length) {
      const { data: orderRows } = await admin
        .from("orders")
        .select("id, user_id, account_email")
        .in(
          "user_id",
          activeClientRows.map((c) => c.id),
        )
        .limit(1000);
      for (const o of orderRows ?? []) {
        if (!o.user_id) continue;
        const arr = orderIdByClient.get(o.user_id) ?? [];
        arr.push(o.id);
        if (o.account_email) arr.push(String(o.account_email));
        orderIdByClient.set(o.user_id, arr);
      }
    }

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

      const tg =
        (c as { telegram_username?: string | null }).telegram_username ?? null;
      const tgId = (c as { telegram_id?: number | null }).telegram_id;

      return {
        id: s?.id ?? null,
        client_id: c.id,
        status: uiStatus,
        last_message_at: lastAt,
        last_message_preview: s ? lastPreviewBySession.get(s.id) ?? null : null,
        unread_operator: s ? unreadBySession.get(s.id) ?? 0 : 0,
        client: {
          full_name: c.username ?? null,
          email: c.email ?? null,
          telegram_username: tg,
          telegram_id: tgId ?? null,
        },
      };
    });

    const filtered = search
      ? result.filter((room) => {
          const tg = (room.client as { telegram_username?: string | null }).telegram_username ?? "";
          const tgId = String((room.client as { telegram_id?: number | null }).telegram_id ?? "");
          const orderIds = (orderIdByClient.get(room.client_id) ?? []).join(" ");
          const searchNorm = search.replace(/^@+/, "");
          const haystack =
            `${room.client.email ?? ""} ${room.client.full_name ?? ""} ${room.client_id} ${room.id ?? ""} @${tg} ${tg} ${tgId} ${orderIds}`
              .toLocaleLowerCase("ru");
          return (
            haystack.includes(search) ||
            haystack.includes(searchNorm) ||
            (room.id ? searchMatchSessionIds.has(room.id) : false)
          );
        })
      : result;

    const { sortStaffChatRooms } = await import("@/lib/chat/sort-staff-rooms");
    return NextResponse.json(sortStaffChatRooms(filtered));
  }

  if (role === "admin" || role === "operator") {
    return NextResponse.json(
      { error: "Для списка чатов используйте ?list=1" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const session = await getOrCreateClientOperatorSession(admin, user.id, "gpt-store");
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
