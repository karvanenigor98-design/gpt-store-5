import { NextRequest, NextResponse } from "next/server";

import { executeTransferStaffAndData } from "@/lib/admin/transferStaffAndData";
import { isServerAdmin } from "@/lib/auth/server-role";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isServerAdmin(user))) {
    return NextResponse.json({ error: "Доступно только администратору" }, { status: 403 });
  }

  let body: { targetUserId?: string; grant?: string; migrateData?: boolean; site?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const site: "gpt-store" | "subs-store" = body.site === "subs-store" ? "subs-store" : "gpt-store";
  const targetUserId = (body.targetUserId ?? "").trim();
  const grant =
    body.grant === "admin" ? "admin" : body.grant === "operator" ? "operator" : null;
  const migrateData = Boolean(body.migrateData);

  if (!targetUserId || !grant) {
    return NextResponse.json(
      { error: "Нужны targetUserId и grant: admin или operator" },
      { status: 400 },
    );
  }

  const db = site === "subs-store" ? createSubsStoreAdminClient() : createAdminClient();
  if (!db) {
    return NextResponse.json(
      {
        error:
          "Subs Supabase админ недоступен: проверьте SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY",
      },
      { status: 503 },
    );
  }

  const result = await executeTransferStaffAndData({
    db,
    gptUser: user,
    site,
    targetUserId,
    grant,
    migrateData,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    role: result.role,
    migrateData: result.migrateData,
    counts: result.counts,
  });
}
