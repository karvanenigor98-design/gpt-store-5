import { NextResponse } from "next/server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Счётчик непрочитанных для текущего пользователя (как клиента):
 * входящие от оператора/авто/ai с is_read = false.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ unread: 0 });
  }

  const admin = createAdminClient();
  const { data: sessions } = await admin
    .from("chat_sessions")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "operator");

  const sessionIds = (sessions ?? []).map((s) => s.id).filter(Boolean);
  if (sessionIds.length === 0) {
    return NextResponse.json({ unread: 0 });
  }

  const { count, error } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds)
    .in("sender_type", ["operator", "admin", "auto", "ai"])
    .eq("is_read", false);

  if (error) {
    return NextResponse.json({ unread: 0 });
  }

  return NextResponse.json({ unread: count ?? 0 });
}
