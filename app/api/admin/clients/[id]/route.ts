import { NextRequest, NextResponse } from "next/server";

import { isServerAdmin } from "@/lib/auth/server-role";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const ALLOWED_STAGES = ["purchased", "waiting", "no_purchase", "needs_help", "other"] as const;

/**
 * Обновление заметки и этапа клиента (только админ).
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await ctx.params;
  if (!clientId) {
    return NextResponse.json({ error: "Нет id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await isServerAdmin(user))) {
    return NextResponse.json({ error: "Только администратор" }, { status: 403 });
  }

  let body: { client_stage?: string | null; notes?: string | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: prof } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", clientId)
    .maybeSingle();

  if (!prof || prof.role !== "client") {
    return NextResponse.json({ error: "Клиент не найден" }, { status: 404 });
  }

  const patch: { notes?: string | null; client_stage?: string | null } = {};
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.client_stage !== undefined) {
    if (body.client_stage === null || body.client_stage === "") {
      patch.client_stage = null;
    } else if ((ALLOWED_STAGES as readonly string[]).includes(body.client_stage)) {
      patch.client_stage = body.client_stage;
    } else {
      return NextResponse.json({ error: "Недопустимый этап" }, { status: 400 });
    }
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Нет полей для обновления" }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from("profiles")
    .update(patch)
    .eq("id", clientId)
    .select("id, notes, client_stage")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Не удалось сохранить" }, { status: 500 });
  }

  return NextResponse.json({ profile: updated });
}
