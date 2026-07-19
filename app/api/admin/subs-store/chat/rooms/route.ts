import { NextRequest, NextResponse } from "next/server";

import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import type { ChatRoomListItem } from "@/types/chat-ui";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("list") !== "1") {
    return NextResponse.json({ error: "Используйте ?list=1" }, { status: 400 });
  }

  const ctx = await requireSubsStaffContext();
  if (ctx instanceof NextResponse) return ctx;

  const { subs } = ctx;
  const qRaw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const q = qRaw.toLowerCase();
  const qNorm = q.replace(/^@+/, "");

  // Prefer open threads; include recent closed only as fallback for search continuity.
  const { data: threads, error: tErr } = await subs
    .from("chat_threads")
    .select("id,user_id,order_id,status,last_message_at,created_at")
    .order("last_message_at", { ascending: false })
    .limit(300);

  if (tErr) {
    return NextResponse.json({ error: "Не удалось загрузить чаты" }, { status: 500 });
  }

  const threadRows = threads ?? [];

  // One room per client: pick best open thread (or best closed if no open).
  const bestByClient = new Map<string, (typeof threadRows)[number]>();
  for (const t of threadRows) {
    const uid = t.user_id as string | null;
    const oid = t.order_id as string | null;
    const clientKey = uid ?? (oid ? `order:${oid}` : null);
    if (!clientKey) continue;

    const prev = bestByClient.get(clientKey);
    if (!prev) {
      bestByClient.set(clientKey, t);
      continue;
    }
    const prevOpen = (prev.status as string) === "open";
    const nextOpen = (t.status as string) === "open";
    if (nextOpen && !prevOpen) {
      bestByClient.set(clientKey, t);
      continue;
    }
    if (nextOpen === prevOpen) {
      const prevAt = Date.parse((prev.last_message_at as string) ?? "") || 0;
      const nextAt = Date.parse((t.last_message_at as string) ?? "") || 0;
      if (nextAt > prevAt) bestByClient.set(clientKey, t);
    }
  }

  const canonicalThreads = [...bestByClient.values()].slice(0, 150);
  const userIds = [...new Set(canonicalThreads.map((t) => t.user_id).filter(Boolean))] as string[];
  const orderIds = [...new Set(canonicalThreads.map((t) => t.order_id).filter(Boolean))] as string[];

  const orderById = new Map<
    string,
    { customer_email: string | null; account_email: string | null; user_id?: string | null }
  >();
  const orderEmailsByUser = new Map<string, string[]>();
  const orderIdsByUser = new Map<string, string[]>();

  if (orderIds.length) {
    const { data: orderRows } = await subs
      .from("orders")
      .select("id, customer_email, account_email, user_id")
      .in("id", orderIds);
    for (const o of orderRows ?? []) {
      orderById.set(o.id as string, {
        customer_email: (o.customer_email as string | null) ?? null,
        account_email: (o.account_email as string | null) ?? null,
        user_id: (o.user_id as string | null) ?? null,
      });
    }
  }

  // Extra orders for users (account_email search across client's orders).
  if (userIds.length) {
    const { data: userOrders } = await subs
      .from("orders")
      .select("id, user_id, customer_email, account_email")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(userIds.length * 20, 800));
    for (const o of userOrders ?? []) {
      const uid = o.user_id as string | null;
      if (!uid) continue;
      const emails = orderEmailsByUser.get(uid) ?? [];
      for (const e of [o.customer_email, o.account_email]) {
        const v = (e as string | null)?.trim();
        if (v && !emails.includes(v)) emails.push(v);
      }
      orderEmailsByUser.set(uid, emails);
      const ids = orderIdsByUser.get(uid) ?? [];
      ids.push(o.id as string);
      orderIdsByUser.set(uid, ids);
      if (!orderById.has(o.id as string)) {
        orderById.set(o.id as string, {
          customer_email: (o.customer_email as string | null) ?? null,
          account_email: (o.account_email as string | null) ?? null,
          user_id: uid,
        });
      }
    }
  }

  const profileById = new Map<
    string,
    { email: string | null; full_name: string | null; telegram_username: string | null }
  >();
  if (userIds.length) {
    let { data: profs, error: pErr } = await subs
      .from("profiles")
      .select("id,email,full_name,telegram_username")
      .in("id", userIds);
    if (pErr?.message?.includes("telegram_username")) {
      const fb = await subs.from("profiles").select("id,email,full_name").in("id", userIds);
      profs = (fb.data ?? []).map((p) => ({ ...p, telegram_username: null }));
    }
    for (const p of profs ?? []) {
      profileById.set(p.id as string, {
        email: (p.email as string) ?? null,
        full_name: (p.full_name as string) ?? null,
        telegram_username: (p as { telegram_username?: string | null }).telegram_username ?? null,
      });
    }
  }

  const threadIds = canonicalThreads.map((t) => t.id);
  const lastPreview = new Map<string, string>();
  const unreadByThread = new Map<string, number>();
  const searchMatchThreadIds = new Set<string>();

  if (threadIds.length) {
    const { data: lastMsgs } = await subs
      .from("chat_messages")
      .select("thread_id,content,created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false })
      .limit(Math.min(threadIds.length * 3, 900));

    const seenThread = new Set<string>();
    for (const m of lastMsgs ?? []) {
      const tid = m.thread_id as string;
      if (!seenThread.has(tid)) {
        seenThread.add(tid);
        const c = (m.content as string) ?? "";
        lastPreview.set(tid, c.length > 80 ? `${c.slice(0, 80)}…` : c);
      }
      if (q && ((m.content as string) ?? "").toLowerCase().includes(q)) {
        searchMatchThreadIds.add(tid);
      }
    }

    if (q) {
      const { data: searchHits } = await subs
        .from("chat_messages")
        .select("thread_id")
        .in("thread_id", threadIds)
        .ilike("content", `%${qRaw}%`)
        .limit(200);
      for (const hit of searchHits ?? []) {
        searchMatchThreadIds.add(hit.thread_id as string);
      }
    }

    const { data: unreadRows } = await subs
      .from("chat_messages")
      .select("thread_id")
      .in("thread_id", threadIds)
      .eq("author_role", "customer")
      .is("read_at", null)
      .limit(5000);

    for (const u of unreadRows ?? []) {
      const tid = u.thread_id as string;
      unreadByThread.set(tid, (unreadByThread.get(tid) ?? 0) + 1);
    }
  }

  const result: ChatRoomListItem[] = [];
  for (const t of canonicalThreads) {
    const uid = t.user_id as string | null;
    const oid = t.order_id as string | null;

    let clientId: string;
    let email: string | null = null;
    let fullName: string | null = null;
    let telegramUsername: string | null = null;

    if (uid) {
      const prof = profileById.get(uid);
      email = prof?.email ?? null;
      fullName = prof?.full_name ?? null;
      telegramUsername = prof?.telegram_username ?? null;
      clientId = uid;
    } else if (oid) {
      const ord = orderById.get(oid);
      email = ord?.customer_email ?? ord?.account_email ?? null;
      fullName = `Заказ ${oid}`;
      clientId = `order:${oid}`;
    } else {
      continue;
    }

    if (q) {
      const linkedEmails = uid ? (orderEmailsByUser.get(uid) ?? []).join(" ") : "";
      const linkedOrderIds = uid ? (orderIdsByUser.get(uid) ?? []).join(" ") : "";
      const ord = oid ? orderById.get(oid) : null;
      const accountEmail = ord?.account_email ?? "";
      const hay =
        `${email ?? ""} ${fullName ?? ""} ${oid ?? ""} ${t.id} @${telegramUsername ?? ""} ${telegramUsername ?? ""} ${linkedEmails} ${linkedOrderIds} ${accountEmail}`.toLowerCase();
      if (
        !hay.includes(q) &&
        !hay.includes(qNorm) &&
        !searchMatchThreadIds.has(t.id as string)
      ) {
        continue;
      }
    }

    const st = (t.status as string) ?? "open";
    let uiStatus: ChatRoomListItem["status"] = "open";
    if (st === "closed") uiStatus = "closed";
    else if (st === "pending") uiStatus = "waiting";
    else uiStatus = "open";

    result.push({
      id: t.id as string,
      client_id: clientId,
      status: uiStatus,
      last_message_at: (t.last_message_at as string) ?? null,
      last_message_preview: lastPreview.get(t.id as string) ?? null,
      unread_operator: unreadByThread.get(t.id as string) ?? 0,
      client: { full_name: fullName, email, telegram_username: telegramUsername },
    });
  }

  const { sortStaffChatRooms } = await import("@/lib/chat/sort-staff-rooms");
  return NextResponse.json(sortStaffChatRooms(result));
}
