import { NextRequest, NextResponse } from "next/server";

import { resolveGptStaffRole } from "@/lib/auth/resolve-gpt-staff-role";
import { loadGptStaffChatRooms } from "@/lib/chat/load-staff-rooms";
import { getOrCreateClientOperatorSession } from "@/lib/chat/operatorSession";
import { readGptCookieUser } from "@/lib/auth/read-gpt-cookie-user";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const roomsMemo = new Map<string, { at: number; rooms: unknown }>();

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
      const search = req.nextUrl.searchParams.get("q")?.trim() ?? "";
      const siteParam = req.nextUrl.searchParams.get("site");
      const cacheKey = `${siteParam ?? ""}:${search}`;
      const cached = roomsMemo.get(cacheKey);
      if (cached && Date.now() - cached.at < 8_000) {
        return NextResponse.json(cached.rooms);
      }

      const admin = createAdminClient();
      const rooms = await Promise.race([
        loadGptStaffChatRooms(admin, { search, siteParam }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("rooms_timeout")), 8_000);
        }),
      ]);
      roomsMemo.set(cacheKey, { at: Date.now(), rooms });
      return NextResponse.json(rooms);
    } catch (err) {
      console.error("[chat/rooms] staff list", err);
      const search = req.nextUrl.searchParams.get("q")?.trim() ?? "";
      const siteParam = req.nextUrl.searchParams.get("site");
      const stale = roomsMemo.get(`${siteParam ?? ""}:${search}`);
      if (stale?.rooms) {
        return NextResponse.json(stale.rooms);
      }
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
