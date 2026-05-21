import { NextRequest, NextResponse } from "next/server";

import { mapSubsChatMessageToChatMessage } from "@/lib/admin/subs-chat-map";
import { insertSubsStoreChatAutoReply } from "@/lib/chat/subsAutoReply";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import { isSubsPublicAuthConfigured } from "@/lib/supabase/subs-auth-env";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

import type { ChatMessage } from "@/types";

function jsonDiagnostic(status: number, message: string, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, code, ...(extra ?? {}) }, { status });
}

export async function GET(req: NextRequest) {
  const threadId = req.nextUrl.searchParams.get("thread_id")?.trim();
  if (!threadId) {
    return jsonDiagnostic(400, "Параметр thread_id обязателен", "missing_thread_id");
  }

  if (!isSubsPublicAuthConfigured()) {
    return jsonDiagnostic(
      503,
      "Subs Auth не сконфигурирован: задайте NEXT_PUBLIC_SUBS_SUPABASE_URL и NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY в .env.local",
      "subs_auth_env_missing",
    );
  }

  const sess = await createSubsAuthServerClient();
  const admin = createSubsStoreAdminClient();
  if (!sess || !admin) {
    return jsonDiagnostic(503, "Не удалось инициировать клиент Supabase для Subs Store", "subs_client_null");
  }

  const {
    data: { user },
  } = await sess.auth.getUser();
  if (!user) {
    return jsonDiagnostic(401, "Требуется вход в аккаунт Subs Store", "unauthorized");
  }

  const { data: thread, error: thErr } = await admin
    .from("chat_threads")
    .select("id,user_id")
    .eq("id", threadId)
    .maybeSingle();

  if (thErr || !thread) {
    return jsonDiagnostic(404, "Чат не найден", "thread_not_found");
  }

  if ((thread as { user_id?: string }).user_id !== user.id) {
    return jsonDiagnostic(403, "Нет доступа к этому чату", "forbidden");
  }

  const { data: messages, error: mErr } = await admin
    .from("chat_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (mErr) {
    console.error("[subs/chat/messages GET]", mErr.message);
    return jsonDiagnostic(
      500,
      `Ошибка чтения сообщений из Subs Store: ${mErr.message}`,
      "subs_db_messages_read",
      { pg: mErr.code ?? null },
    );
  }

  await admin
    .from("chat_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .neq("author_role", "customer")
    .is("read_at", null);

  const list = (messages ?? []).map((row) =>
    mapSubsChatMessageToChatMessage(row as Parameters<typeof mapSubsChatMessageToChatMessage>[0]),
  );

  return NextResponse.json({ messages: list as ChatMessage[] });
}

export async function POST(req: NextRequest) {
  let body: { thread_id?: string; content?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonDiagnostic(400, "Неверный формат JSON", "invalid_json");
  }

  const threadId = body.thread_id?.trim();
  const content = body.content?.trim() ?? "";
  if (!threadId || !content) {
    return jsonDiagnostic(400, "Укажите thread_id и текст сообщения", "missing_body");
  }

  if (!isSubsPublicAuthConfigured()) {
    return jsonDiagnostic(
      503,
      "Subs Auth не сконфигурирован: задайте NEXT_PUBLIC_SUBS_SUPABASE_URL и NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY",
      "subs_auth_env_missing",
    );
  }

  const sess = await createSubsAuthServerClient();
  const admin = createSubsStoreAdminClient();
  if (!sess || !admin) {
    return jsonDiagnostic(503, "Не удалось работать с Subs Store Supabase", "subs_client_null");
  }

  const {
    data: { user },
  } = await sess.auth.getUser();
  if (!user) {
    return jsonDiagnostic(401, "Требуется вход в аккаунт Subs Store", "unauthorized");
  }

  const { data: thread, error: thErr } = await admin
    .from("chat_threads")
    .select("id,user_id")
    .eq("id", threadId)
    .maybeSingle();

  if (thErr || !thread || (thread as { user_id?: string }).user_id !== user.id) {
    return jsonDiagnostic(403, "Нет доступа к отправке сообщения в этот чат", "forbidden_thread");
  }

  const { data: inserted, error: insErr } = await admin
    .from("chat_messages")
    .insert({
      thread_id: threadId,
      author_id: user.id,
      author_role: "customer",
      content,
    })
    .select("*")
    .single();

  if (insErr || !inserted) {
    console.error("[subs/chat/messages POST]", insErr?.message ?? "insert");
    return jsonDiagnostic(
      500,
      `Не удалось сохранить сообщение в Subs Store: ${insErr?.message ?? "неизвестно"}`,
      "subs_insert_message",
    );
  }

  await admin
    .from("chat_threads")
    .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", threadId);

  const { alertStaffOnClientSupportMessage } = await import("@/lib/notifications/client-chat-alert");
  void alertStaffOnClientSupportMessage({
    siteSlug: "subs-store",
    sessionId: threadId,
    clientUserId: user.id,
    clientEmail: user.email ?? null,
    messagePreview: content,
  }).catch((err) => console.error("[subs/chat/messages] staff alert:", err));

  const message = mapSubsChatMessageToChatMessage(
    inserted as Parameters<typeof mapSubsChatMessageToChatMessage>[0],
  );

  let autoReply: ChatMessage | null = null;
  try {
    autoReply = await insertSubsStoreChatAutoReply(admin, threadId, content);
  } catch (err) {
    console.error("[subs/chat/messages] auto-reply:", err);
  }

  return NextResponse.json({
    ok: true,
    message,
    autoReply,
  });
}
