import { NextResponse } from "next/server";
import { readGptCookieUser } from "@/lib/auth/read-gpt-cookie-user";

import { resolveStaffChatPeer } from "@/lib/auth/staffPeer";
import { resolveServerRole } from "@/lib/auth/server-role";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Кто собеседник во внутреннем чате admin ↔ operator.
 */
export async function GET() {
  const supabase = await createClient();
  const { user } = await readGptCookieUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const admin = createAdminClient();
  const peer = await resolveStaffChatPeer(admin, role, user.id);
  if (!peer) {
    return NextResponse.json(
      { error: "Не найден второй участник (нужен оператор в БД для админа или админ для оператора)" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    peerId: peer.peerId,
    peerRole: peer.peerRole,
  });
}
