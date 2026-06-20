import { NextRequest, NextResponse } from "next/server";

import { resolveServerRole } from "@/lib/auth/server-role";
import { canSendChatEmailNotification } from "@/lib/chat/email-notification-throttle";
import { markStaffChatNotificationsRead } from "@/lib/admin/mark-staff-notifications-read";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { resolveHumanSenderType } from "@/lib/chat/messageSender";
import { isStaffSessionParticipant } from "@/lib/chat/staffSession";
import {
  isChatSessionForSubsStore,
  notifySubsStoreCustomerChatReply,
} from "@/lib/subs/subs-notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { alertStaffOnClientSupportMessage } from "@/lib/notifications/client-chat-alert";
import { notifyCustomerAboutChatMessage } from "@/lib/telegram/notifications";
import { getMessageLengthError, isBlankMessage } from "@/lib/chat/message-validation";
import type { ChatMessage } from "@/types";
import type { Json } from "@/types/database";

type SessionAccessRow = {
  id: string;
  user_id: string | null;
  type: string;
  staff_peer_id: string | null;
  site_id: string | null;
};

function canAccessSupportSession(
  authUserId: string | null,
  sessionUserId: string | null,
  isStaff: boolean
): boolean {
  if (isStaff) return true;
  if (!authUserId) return !sessionUserId;
  if (!sessionUserId || sessionUserId === authUserId) return true;
  return false;
}

function canAccessSessionRow(
  authUserId: string | null,
  session: SessionAccessRow,
  isStaff: boolean
): boolean {
  if (session.type === "staff") {
    if (!authUserId) return false;
    return isStaffSessionParticipant(session, authUserId);
  }
  if (session.type !== "operator" && session.type !== "ai") {
    return false;
  }
  return canAccessSupportSession(authUserId, session.user_id, isStaff);
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "session_id обязателен" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  const isStaff = role === "admin" || role === "operator";

  const { data: sessionRow, error: sessionError } = await supabaseAdmin
    .from("chat_sessions")
    .select("id, user_id, type, staff_peer_id, site_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !sessionRow?.id) {
    return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
  }

  const session = sessionRow as SessionAccessRow;

  if (!isStaff && session.type !== "operator" && session.type !== "ai") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  if (!canAccessSessionRow(user.id, session, isStaff)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { data: messages, error: msgError } = await supabaseAdmin
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(50000);

  if (msgError) {
    return NextResponse.json({ error: "Не удалось загрузить сообщения" }, { status: 500 });
  }

  const list = (messages ?? []) as ChatMessage[];
  const byId = new Map(list.map((m) => [m.id, m]));
  const withReply = list.map((m) => {
    const replyToId = (m as ChatMessage & { reply_to_message_id?: string | null }).reply_to_message_id ?? null;
    if (!replyToId) return m;
    const target = byId.get(replyToId);
    return {
      ...m,
      reply_to_message: target
        ? {
            id: target.id,
            sender_type: target.sender_type,
            content: target.content,
            is_deleted: (target as ChatMessage & { is_deleted?: boolean }).is_deleted ?? false,
          }
        : { id: replyToId, sender_type: "auto", content: "", is_deleted: true },
    } as ChatMessage;
  });

  if (isStaff) {
    await supabaseAdmin
      .from("chat_messages")
      .update({ is_read: true })
      .eq("session_id", sessionId)
      .eq("sender_type", "client")
      .eq("is_read", false);
    const subsChat =
      session.site_id != null ? await isChatSessionForSubsStore(session.site_id) : false;
    const notifAdmin = subsChat ? createSubsStoreAdminClient() : createAdminClient();
    if (notifAdmin) {
      await markStaffChatNotificationsRead(notifAdmin, {
        entityId: sessionId,
        userId: user.id,
      });
    }
  } else {
    await supabaseAdmin
      .from("chat_messages")
      .update({ is_read: true })
      .eq("session_id", sessionId)
      .in("sender_type", ["operator", "admin", "auto", "ai"]);
  }

  return NextResponse.json({ messages: withReply });
}

export async function POST(req: NextRequest) {
  let body: {
    session_id?: string;
    content?: string;
    attachment?: { url: string; type: string; name: string } | null;
    reply_to_message_id?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const sessionId = body.session_id?.trim();
  const content = typeof body.content === "string" ? body.content : "";
  const contentLengthError = getMessageLengthError(content);
  if (!sessionId) {
    return NextResponse.json({ error: "session_id обязателен" }, { status: 400 });
  }
  if (contentLengthError) {
    return NextResponse.json({ error: contentLengthError }, { status: 400 });
  }
  if (isBlankMessage(content) && !body.attachment?.url) {
    return NextResponse.json({ error: "Пустое сообщение" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sessionRow, error: sessionError } = await supabaseAdmin
    .from("chat_sessions")
    .select("id, user_id, type, staff_peer_id, site_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError || !sessionRow?.id) {
    return NextResponse.json({ error: "Сессия чата не найдена" }, { status: 404 });
  }

  const session = sessionRow as SessionAccessRow;

  const role = await resolveServerRole(user);
  const isStaff = role === "admin" || role === "operator";

  if (!canAccessSessionRow(user.id, session, isStaff)) {
    return NextResponse.json({ error: "Нет доступа к этой сессии" }, { status: 403 });
  }

  if (!isStaff && session.type !== "operator" && session.type !== "ai") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  if (sessionRow.user_id && sessionRow.user_id !== user.id && !isStaff) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  if (!sessionRow.user_id || sessionRow.user_id === user.id) {
    if (!isStaff && (session.type === "operator" || session.type === "ai")) {
      await supabaseAdmin.from("chat_sessions").update({ user_id: user.id }).eq("id", sessionId);
    }
  }

  const senderType = resolveHumanSenderType(role);
  const attachments: Json | null = body.attachment ? (body.attachment as unknown as Json) : null;
  const replyToMessageId = body.reply_to_message_id?.trim() || null;

  const insertPayload = {
    session_id: sessionId,
    sender_id: user.id,
    sender_type: senderType,
    content: isBlankMessage(content) ? (body.attachment ? `📎 ${body.attachment.name}` : " ") : content,
    attachments,
    is_read: false,
    ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
  };

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("chat_messages")
    // reply_to/deleted columns are introduced by migration 015; generated types may lag.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(insertPayload as any)
    .select("*")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 500 });
  }

  if (!isStaff) {
    await supabaseAdmin
      .from("chat_sessions")
      .update({ first_message_at: new Date().toISOString() })
      .eq("id", sessionId)
      .is("first_message_at", null);
  } else if (session.type === "operator" || session.type === "ai") {
    await supabaseAdmin
      .from("chat_sessions")
      .update({ last_operator_reply_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  const textForNotify = isBlankMessage(content) ? body.attachment?.name || "вложение" : content;
  if (session.type === "operator" || session.type === "ai") {
    const subsStoreChat =
      session.site_id != null ? await isChatSessionForSubsStore(session.site_id) : false;
    const siteSlug: "gpt-store" | "subs-store" = subsStoreChat ? "subs-store" : "gpt-store";

    if (senderType === "client") {
      void alertStaffOnClientSupportMessage({
        siteSlug,
        sessionId,
        clientUserId: session.user_id ?? user.id,
        clientEmail: user.email ?? null,
        messagePreview: textForNotify,
      }).catch((err) => console.error("[chat/messages] staff alert:", err));
    } else if ((senderType === "operator" || senderType === "admin") && session.user_id) {
      const { count: unreadForCustomer } = await supabaseAdmin
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .in("sender_type", ["operator", "admin"])
        .eq("is_read", false);

      const { data: customerProfile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", session.user_id)
        .maybeSingle();

      const customerEmail = customerProfile?.email?.trim();
      // Шлем письмо только когда у клиента есть непрочитанные сообщения от staff.
      if (customerEmail && (unreadForCustomer ?? 0) > 0) {
        if (canSendChatEmailNotification(`customer:${siteSlug}:${sessionId}`)) {
          await notifyCustomerAboutChatMessage({
            customerEmail,
            customerUserId: session.user_id,
            senderRoleLabel: senderType === "admin" ? "Администратор" : "Оператор",
            messagePreview: textForNotify,
            sessionId,
            siteSlug,
          }).catch(() => undefined);
        }
      }

      if (subsStoreChat) {
        void notifySubsStoreCustomerChatReply({
          sessionId,
          customerUserId: session.user_id,
          messagePreview: textForNotify,
        }).catch(() => undefined);
      } else {
        const { notifyGptCustomerChatReply } = await import("@/lib/notifications/gpt-customer-notifications");
        void notifyGptCustomerChatReply({
          sessionId,
          customerUserId: session.user_id,
          messagePreview: textForNotify,
        }).catch(() => undefined);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    message: inserted as ChatMessage,
    autoReply: null,
  });
}

export async function PATCH(req: NextRequest) {
  let body: { id?: string; action?: "delete" };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const messageId = body.id?.trim();
  if (!messageId || body.action !== "delete") {
    return NextResponse.json({ error: "Нужны id и action=delete" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  const isStaff = role === "admin" || role === "operator";
  if (!isStaff) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const { data: row, error: rowErr } = await supabaseAdmin
    .from("chat_messages")
    .select("id")
    .eq("id", messageId)
    .maybeSingle();
  if (rowErr || !row?.id) {
    return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
  }

  const deletePayload = {
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: user.id,
    content: "Сообщение удалено",
    attachments: null,
  };

  const { error: updateErr } = await supabaseAdmin
    .from("chat_messages")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(deletePayload as any)
    .eq("id", messageId);

  if (updateErr) {
    return NextResponse.json({ error: "Не удалось удалить сообщение" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
