import { NextResponse } from "next/server";

import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export async function GET() {
  const auth = await createSubsAuthServerClient();
  const admin = createSubsStoreAdminClient();
  if (!auth || !admin) {
    return NextResponse.json({ unread: 0 }, { status: 503 });
  }

  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ unread: 0 }, { status: 401 });
  }

  const { data: threads, error: threadError } = await admin
    .from("chat_threads")
    .select("id")
    .eq("user_id", user.id);

  if (threadError) {
    return NextResponse.json({ unread: 0 }, { status: 500 });
  }

  const threadIds = (threads ?? []).map((thread) => String(thread.id));
  if (!threadIds.length) {
    return NextResponse.json({ unread: 0 });
  }

  const { count, error } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .in("thread_id", threadIds)
    .neq("author_role", "customer")
    .is("read_at", null);

  return NextResponse.json(
    { unread: error ? 0 : count ?? 0 },
    { status: error ? 500 : 200 },
  );
}
