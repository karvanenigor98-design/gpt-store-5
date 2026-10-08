import { NextRequest, NextResponse } from "next/server";

import { resolveGptStaffRole } from "@/lib/auth/resolve-gpt-staff-role";
import { loadGptStaffChatRooms } from "@/lib/chat/load-staff-rooms";
import { getOrCreateClientOperatorSession } from "@/lib/chat/operatorSession";
import { readGptCookieUser } from "@/lib/auth/read-gpt-cookie-user";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

async function handleRooms(req: NextRequest) {
  const supabase = await createClient();
  const { user } = await readGptCookieUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = req.nextUrl.searchParams.get("list") === "1";

  if (list) {
    const role = await resolveGptStaffRole(user);
    if (role !== "admin" && role !== "operator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
      const admin = createAdminClient();
      const rooms = await loadGptStaffChatRooms(admin, {
        search: req.nextUrl.searchParams.get("q")?.trim() ?? "",
        siteParam: req.nextUrl.searchParams.get("site"),
      });
      return NextResponse.json(rooms);
    } catch (err) {
      console.error("[chat/rooms] staff list", err);
      return NextResponse.json({ error: "Не удалось загрузить чаты" }, { status: 503 });
    }
  }

  const role = await resolveGptStaffRole(user);

  if (role === "admin" || role === "operator") {
    return NextResponse.json(
      { error: "Для списка чатов используйте ?list=1" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const session = await getOrCreateClientOperatorSession(admin, user.id, "gpt-store");
  if (!session) {
    return NextResponse.json({ error: "Не удалось создать чат" }, { status: 500 });
  }

  const { data: lastMsg } = await admin
    .from("chat_messages")
    .select("created_at")
    .eq("session_id", session.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    id: session.id,
    status: session.status,
    last_message_at: lastMsg?.created_at ?? null,
  });
}

export async function GET(req: NextRequest) {
  return handleRooms(req);
}

export async function POST(req: NextRequest) {
  return handleRooms(req);
}
