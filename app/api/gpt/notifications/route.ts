import { NextRequest, NextResponse } from "next/server";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { createAdminClient, createClient } from "@/lib/supabase/server";

function diag(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return diag(401, "Войдите в аккаунт GPT STORE");
  }

  const admin = createAdminClient();
  const siteId = await getSiteUUID("gpt-store");

  let query = admin
    .from("notifications")
    .select("id,type,title,message,entity_type,entity_id,is_read,created_at")
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (siteId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = (query as any).or(`site_id.eq.${siteId},site_id.is.null`) as typeof query;
  }

  const { data, error } = await query;
  if (error) {
    return diag(500, "Не удалось загрузить уведомления");
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return diag(401, "Требуется вход");
  }

  let body: { id?: string; mark_all?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return diag(400, "Неверный JSON");
  }

  const admin = createAdminClient();

  if (body.mark_all) {
    const { error } = await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", user.id)
      .eq("is_read", false);
    if (error) {
      return diag(500, "Не удалось обновить уведомления");
    }
    return NextResponse.json({ ok: true });
  }

  const id = body.id?.trim();
  if (!id) {
    return diag(400, "id обязателен");
  }

  const { error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("recipient_user_id", user.id);

  if (error) {
    return diag(500, "Не удалось обновить уведомление");
  }

  return NextResponse.json({ ok: true });
}
