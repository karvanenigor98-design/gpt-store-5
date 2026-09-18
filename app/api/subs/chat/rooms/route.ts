import { NextResponse } from "next/server";

import { getOrCreateSubsCustomerSupportThread } from "@/lib/chat/subs-support-thread";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export async function GET() {
  const auth = await createSubsAuthServerClient();
  const admin = createSubsStoreAdminClient();
  if (!auth || !admin) {
    return NextResponse.json({ error: "Spotify Store chat не настроен" }, { status: 503 });
  }

  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Требуется вход в Spotify Store" }, { status: 401 });
  }

  const thread = await getOrCreateSubsCustomerSupportThread(admin, user.id);
  if (!thread) {
    return NextResponse.json({ error: "Не удалось создать чат" }, { status: 500 });
  }

  const { data: row } = await admin
    .from("chat_threads")
    .select("id,status,last_message_at")
    .eq("id", thread.id)
    .single();

  if (!row) {
    return NextResponse.json({ error: "Чат не найден" }, { status: 404 });
  }

  return NextResponse.json({
    id: String(row.id),
    status: row.status === "closed" ? "closed" : row.status === "pending" ? "waiting" : "open",
    last_message_at: row.last_message_at ?? null,
  });
}
