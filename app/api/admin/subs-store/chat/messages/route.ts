import { NextRequest, NextResponse } from "next/server";

import { markStaffChatNotificationsRead } from "@/lib/admin/mark-staff-notifications-read";
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { mapSubsChatMessageToChatMessage } from "@/lib/admin/subs-chat-map";
import { resolveServerRole } from "@/lib/auth/server-role";
import { canSendChatEmailNotification } from "@/lib/chat/email-notification-throttle";
import { getMessageLengthError, isBlankMessage } from "@/lib/chat/message-validation";
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

  await markStaffChatNotificationsRead(subs, {
    entityId: threadId,
    userId: ctx.user.id,
  });

  const list = (messages ?? []).map((row) => mapSubsChatMessageToChatMessage(row as Parameters<typeof mapSubsChatMessageToChatMessage>[0]));
  const byId = new Map(list.map((m) => [m.id, m]));
  const withReply = list.map((m) => {
    const replyToId = (m as { reply_to_message_id?: string | null }).reply_to_message_id ?? null;
    if (!replyToId) return m;
    const target = byId.get(replyToId);
    return {
      ...m,
      reply_to_message: target
        ? {
            id: target.id,
            sender_type: target.sender_type,
            content: target.content,
            is_deleted: (target as { is_deleted?: boolean }).is_deleted ?? false,
          }
        : { id: replyToId, sender_type: "auto", content: "", is_deleted: true },
    };
  });

  return NextResponse.json({ messages: withReply });
}

export async function POST(req: NextRequest) {
  let body: { thread_id?: string; content?: string; reply_to_message_id?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const threadId = body.thread_id?.trim();
  const content = typeof body.content === "string" ? body.content : "";
  const contentLengthError = getMessageLengthError(content);
  const replyToMessageId = body.reply_to_message_id?.trim() || null;
  if (!threadId) {
    return NextResponse.json({ error: "thread_id и content обязательны" }, { status: 400 });
  }
  if (contentLengthError) {
    return NextResponse.json({ error: contentLengthError }, { status: 400 });
  }
  if (isBlankMessage(content)) {
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
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
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

export async function PATCH(req: NextRequest) {
  let body: { id?: string; action?: "delete" };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const messageId = body.id?.trim();
  if (!messageId || body.action !== "delete") {
    return NextResponse.json({ error: "Нужны id и action=delete" }, { status: 400 });
  }

  const ctx = await requireSubsStaffContext();
  if (ctx instanceof NextResponse) return ctx;

  const { error } = await ctx.subs
    .from("chat_messages")
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: ctx.user.id,
      content: "Сообщение удалено",
      attachment_url: null,
      attachment_type: null,
    })
    .eq("id", messageId);

  if (error) {
    return NextResponse.json({ error: "Не удалось удалить сообщение" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
