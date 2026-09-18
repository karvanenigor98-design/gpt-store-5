import { NextRequest, NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/server-role";
import { resolveHumanSenderType } from "@/lib/chat/messageSender";
import { getMessageLengthError, isBlankMessage } from "@/lib/chat/message-validation";
import { getOrCreateClientOperatorSession } from "@/lib/chat/operatorSession";

export async function POST(req: NextRequest) {
  let body: { userId?: string; content?: string };
  try {
    body = (await req.json()) as { userId?: string; content?: string };
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const content = typeof body.content === "string" ? body.content : "";
  const contentLengthError = getMessageLengthError(content);
  if (!userId) {
    return NextResponse.json({ error: "userId и content обязательны" }, { status: 400 });
  }
  if (contentLengthError) {
    return NextResponse.json({ error: contentLengthError }, { status: 400 });
  }
  if (isBlankMessage(content)) {
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
  const session = await getOrCreateClientOperatorSession(admin, userId, "gpt-store");
  if (!session?.id) {
    return NextResponse.json({ error: "Не удалось создать сессию" }, { status: 500 });
  }
  const sessionId = session.id;

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

