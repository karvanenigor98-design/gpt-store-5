import { NextRequest, NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/server-role";
import { resolveHumanSenderType } from "@/lib/chat/messageSender";

export async function POST(req: NextRequest) {
  let body: { userId?: string; content?: string };
  try {
    body = (await req.json()) as { userId?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const content = body.content?.trim();
  if (!userId || !content) {
    return NextResponse.json({ error: "userId и content обязательны" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const senderType = resolveHumanSenderType(role);

  const admin = createAdminClient();
  const { data: sessionRow } = await admin
    .from("chat_sessions")
    .select("id, status")
    .eq("user_id", userId)
    .eq("type", "operator")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionRow?.id && sessionRow.status !== "open") {
    await admin
      .from("chat_sessions")
      .update({ status: "open" })
      .eq("id", sessionRow.id);
  }

  let sessionId = sessionRow?.id ?? null;
  if (!sessionId) {
    const { data: created, error: createError } = await admin
      .from("chat_sessions")
      .insert({
        user_id: userId,
        type: "operator",
        status: "open",
        first_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (createError || !created?.id) {
      return NextResponse.json({ error: "Не удалось создать сессию" }, { status: 500 });
    }
    sessionId = created.id;
  }

  const { error: insertError } = await admin.from("chat_messages").insert({
    session_id: sessionId,
    sender_id: user.id,
    sender_type: senderType,
    content,
  });

  if (insertError) {
    return NextResponse.json({ error: "Не удалось отправить сообщение" }, { status: 500 });
  }

  await admin
    .from("chat_sessions")
    .update({ last_operator_reply_at: new Date().toISOString() })
    .eq("id", sessionId);

  return NextResponse.json({ ok: true, sessionId });
}

