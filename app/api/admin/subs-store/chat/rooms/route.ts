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
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const { data: threads, error: tErr } = await subs
    .from("chat_threads")
    .select("id,user_id,order_id,status,last_message_at,created_at")
    .order("last_message_at", { ascending: false })
    .limit(150);

  if (tErr) {
    return NextResponse.json({ error: "Не удалось загрузить чаты" }, { status: 500 });
  }

  const threadRows = threads ?? [];
  const userIds = [...new Set(threadRows.map((t) => t.user_id).filter(Boolean))] as string[];
  const orderIds = [...new Set(threadRows.map((t) => t.order_id).filter(Boolean))] as string[];

  const orderById = new Map<string, { customer_email: string | null; account_email: string | null }>();
  if (orderIds.length) {
    const { data: orderRows } = await subs
      .from("orders")
      .select("id, customer_email, account_email")
      .in("id", orderIds);
    for (const o of orderRows ?? []) {
      orderById.set(o.id as string, {
        customer_email: (o.customer_email as string | null) ?? null,
        account_email: (o.account_email as string | null) ?? null,
      });
    }
  }

  const profileById = new Map<string, { email: string | null; full_name: string | null }>();
  if (userIds.length) {
    const { data: profs } = await subs.from("profiles").select("id,email,full_name").in("id", userIds);
    for (const p of profs ?? []) {
      profileById.set(p.id as string, { email: (p.email as string) ?? null, full_name: (p.full_name as string) ?? null });
    }
  }

  const threadIds = threadRows.map((t) => t.id);
  const lastPreview = new Map<string, string>();
  const unreadByThread = new Map<string, number>();

  if (threadIds.length) {
    const { data: lastMsgs } = await subs
      .from("chat_messages")
      .select("thread_id,content,created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });

    const seenThread = new Set<string>();
    for (const m of lastMsgs ?? []) {
      const tid = m.thread_id as string;
      if (!seenThread.has(tid)) {
        seenThread.add(tid);
        const c = (m.content as string) ?? "";
        lastPreview.set(tid, c.length > 80 ? `${c.slice(0, 80)}…` : c);
      }
    }

    const { data: unreadRows } = await subs
      .from("chat_messages")
      .select("thread_id")
      .in("thread_id", threadIds)
      .eq("author_role", "customer")
      .is("read_at", null);

    for (const u of unreadRows ?? []) {
      const tid = u.thread_id as string;
      unreadByThread.set(tid, (unreadByThread.get(tid) ?? 0) + 1);
    }
  }

  const result: ChatRoomListItem[] = [];
  for (const t of threadRows) {
    const uid = t.user_id as string | null;
    const oid = t.order_id as string | null;

    let clientId: string;
    let email: string | null = null;
    let fullName: string | null = null;

    if (uid) {
      const prof = profileById.get(uid);
      email = prof?.email ?? null;
      fullName = prof?.full_name ?? null;
      clientId = uid;
    } else if (oid) {
      const ord = orderById.get(oid);
      email = ord?.customer_email ?? ord?.account_email ?? null;
      fullName = `Заказ ${oid.slice(0, 8)}`;
      clientId = `order:${oid}`;
    } else {
      continue;
    }

    if (q) {
      const hay = `${email ?? ""} ${fullName ?? ""} ${oid ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
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
      client: { full_name: fullName, email },
    });
  }

  return NextResponse.json(result);
}
