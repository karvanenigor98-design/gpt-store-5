import { NextRequest, NextResponse } from "next/server";

import { markStaffChatNotificationsRead } from "@/lib/admin/mark-staff-notifications-read";
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { mapSubsChatMessageToChatMessage } from "@/lib/admin/subs-chat-map";
import { resolveServerRole } from "@/lib/auth/server-role";
import { canSendChatEmailNotification } from "@/lib/chat/email-notification-throttle";
import { notifySubsStoreCustomerChatReply } from "@/lib/subs/subs-notifications";
import { notifyCustomerAboutChatMessage } from "@/lib/telegram/notifications";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("thread_id")?.trim();
  if (!threadId) {
    return NextResponse.json({ error: "thread_id обязателен" }, { status: 400 });
  }

  const ctx = await requireSubsStaffContext();
  if (ctx instanceof NextResponse) return ctx;

  const { subs } = ctx;

  const { data: thread, error: thErr } = await subs.from("chat_threads").select("id").eq("id", threadId).maybeSingle();
  if (thErr || !thread) {
    return NextResponse.json({ error: "Тред не найден" }, { status: 404 });
  }

  const { data: messages, error: mErr } = await subs
    .from("chat_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (mErr) {
    return NextResponse.json({ error: "Не удалось загрузить сообщения" }, { status: 500 });
  }

  await subs
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("author_role", "customer")
    .is("read_at", null);

  await markStaffChatNotificationsRead(threadId, "subs-store");

  const list = (messages ?? []).map((row) => mapSubsChatMessageToChatMessage(row as Parameters<typeof mapSubsChatMessageToChatMessage>[0]));

  return NextResponse.json({ messages: list });
}

export async function POST(req: NextRequest) {
  let body: { thread_id?: string; content?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const threadId = body.thread_id?.trim();
  const content = body.content?.trim() ?? "";
  if (!threadId || !content) {
    return NextResponse.json({ error: "thread_id и content обязательны" }, { status: 400 });
  }

  const ctx = await requireSubsStaffContext();
  if (ctx instanceof NextResponse) return ctx;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  const authorRole = role === "admin" ? "admin" : "operator";

  const { subs } = ctx;

  const { data: thread, error: thErr } = await subs.from("chat_threads").select("id,user_id").eq("id", threadId).maybeSingle();
  if (thErr || !thread) {
    return NextResponse.json({ error: "Тред не найден" }, { status: 404 });
  }

  const { data: inserted, error: insErr } = await subs
    .from("chat_messages")
    .insert({
      thread_id: threadId,
      author_id: null,
      author_role: authorRole,
      content,
    })
    .select("*")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 500 });
  }

  await subs
    .from("chat_threads")
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", threadId);

  const customerId = (thread as { user_id?: string | null }).user_id;
  void notifySubsStoreCustomerChatReply({
    sessionId: threadId,
    customerUserId: customerId,
    messagePreview: content,
  }).catch(() => undefined);

  if (customerId) {
    const { data: authUser } = await subs.auth.admin.getUserById(customerId);
    const customerEmail = authUser?.user?.email?.trim();
    if (
      customerEmail &&
      canSendChatEmailNotification(`customer:subs-store:${threadId}`)
    ) {
      void notifyCustomerAboutChatMessage({
        customerEmail,
        customerUserId: customerId,
        senderRoleLabel: authorRole === "admin" ? "Администратор" : "Оператор",
        messagePreview: content,
        sessionId: threadId,
        siteSlug: "subs-store",
      }).catch(() => undefined);
    }
  }

  return NextResponse.json({
    ok: true,
    message: mapSubsChatMessageToChatMessage(inserted as Parameters<typeof mapSubsChatMessageToChatMessage>[0]),
  });
}
