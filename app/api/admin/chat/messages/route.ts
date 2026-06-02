import { NextRequest, NextResponse } from "next/server";

import { resolveServerRole } from "@/lib/auth/server-role";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Сообщения чата с клиентом: загружаем через service role, чтобы оператор/админ
 * видели историю независимо от RLS (роль в env не совпадает с profiles.role).
 * Объединяем все сессии type=operator для userId, чтобы ничего не «терялось».
 */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId обязателен" }, { status: 400 });
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

  const admin = createAdminClient();
  const { data: sessions, error: sessionsError } = await admin
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "operator")
    .order("created_at", { ascending: true });

  if (sessionsError) {
    return NextResponse.json({ error: "Не удалось загрузить сессии" }, { status: 500 });
  }

  const sessionIds = (sessions ?? []).map((s) => s.id).filter(Boolean);
  if (sessionIds.length === 0) {
    return NextResponse.json({ messages: [], sessionIds: [] as string[] });
  }

  const { data: messages, error: messagesError } = await admin
    .from("chat_messages")
    .select("*")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: true })
    .limit(50000);

  if (messagesError) {
    return NextResponse.json({ error: "Не удалось загрузить сообщения" }, { status: 500 });
  }

  return NextResponse.json({
    messages: messages ?? [],
    sessionIds,
  });
}
