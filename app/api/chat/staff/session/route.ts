import { NextRequest, NextResponse } from "next/server";

import { readGptCookieUser } from "@/lib/auth/read-gpt-cookie-user";
import { resolveServerRole } from "@/lib/auth/server-role";
import { getOrCreateStaffSession } from "@/lib/chat/staffSession";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Создать или получить внутренний чат admin ↔ operator (не клиентский).
 */
export async function POST(req: NextRequest) {
  let body: { peerUserId?: string };
  try {
    body = (await req.json()) as { peerUserId?: string };
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const peerUserId = body.peerUserId?.trim();
  if (!peerUserId) {
    return NextResponse.json({ error: "peerUserId обязателен" }, { status: 400 });
  }

  const supabase = await createClient();
  const { user } = await readGptCookieUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: peerProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", peerUserId)
    .maybeSingle();

  if (peerProfile?.role !== "admin" && peerProfile?.role !== "operator") {
    return NextResponse.json({ error: "Внутренний чат только между сотрудниками" }, { status: 400 });
  }

  const session = await getOrCreateStaffSession(admin, user.id, peerUserId);
  if (!session?.id) {
    return NextResponse.json({ error: "Не удалось создать сессию" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: session.id });
}
