import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/server-role";
import { pickCanonicalOperatorSession } from "@/lib/chat/operatorSession";
import { getOrCreateSubsCustomerSupportThread } from "@/lib/chat/subs-support-thread";
import { getSiteUUID } from "@/lib/admin/getSiteId";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { Database } from "@/types/database";

function normalizeStaffSiteSlug(raw: string | undefined): "gpt-store" | "subs-store" | undefined {
  return raw === "subs-store" || raw === "gpt-store" ? raw : undefined;
}

export async function POST(req: NextRequest) {
  let body: { userId?: string; site?: string };
  try {
    body = (await req.json()) as { userId?: string; site?: string };
  } catch {
    return NextResponse.json({ error: "Неверный формат запроса" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId обязателен" }, { status: 400 });
  }

  const siteSlug = normalizeStaffSiteSlug(body.site?.trim());

  if (siteSlug === "subs-store") {
    const subsAdmin = createSubsStoreAdminClient();
    if (!subsAdmin) {
      return NextResponse.json(
        { error: "Subs Supabase админ недоступен" },
        { status: 503 },
      );
    }
    const thread = await getOrCreateSubsCustomerSupportThread(subsAdmin, userId);
    if (!thread?.id) {
      return NextResponse.json({ error: "Не удалось создать тред поддержки" }, { status: 500 });
    }
    return NextResponse.json({ sessionId: thread.id, threadId: thread.id });
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
  const existing = await pickCanonicalOperatorSession(admin, userId, siteSlug);

  if (existing?.id) {
    if (existing.status !== "open") {
      await admin
        .from("chat_sessions")
        .update({ status: "open" })
        .eq("id", existing.id);
    }
    return NextResponse.json({ sessionId: existing.id });
  }

  const siteUuid = siteSlug ? await getSiteUUID(siteSlug) : null;
  const insertRow: Database["public"]["Tables"]["chat_sessions"]["Insert"] = {
    user_id: userId,
    type: "operator",
    status: "open",
    ...(siteUuid ? { site_id: siteUuid } : {}),
  };

  const { data: created, error } = await admin
    .from("chat_sessions")
    .insert(insertRow)
    .select("id")
    .single();

  if (error || !created?.id) {
    return NextResponse.json({ error: "Не удалось создать сессию" }, { status: 500 });
  }

  return NextResponse.json({ sessionId: created.id });
}

