import { NextRequest, NextResponse } from "next/server";

import { humanizeSubsSupabaseError } from "@/lib/admin/subs-network-error";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import { isSubsPublicAuthConfigured } from "@/lib/supabase/subs-auth-env";
import { createSubsStoreAdminClient, isSubsStoreBackendConfigured } from "@/lib/supabase/subs-store-admin";

function diag(status: number, message: string, code: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

export async function GET() {
  if (!isSubsPublicAuthConfigured()) {
    return diag(
      503,
      "Subs Auth не настроен: NEXT_PUBLIC_SUBS_SUPABASE_URL и NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY в .env.local",
      "subs_auth_env_missing",
    );
  }
  if (!isSubsStoreBackendConfigured()) {
    return diag(
      503,
      "Subs Store DB не подключена: задайте SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY на сервере",
      "subs_db_env_missing",
    );
  }

  const sess = await createSubsAuthServerClient();
  const admin = createSubsStoreAdminClient();
  if (!sess || !admin) {
    return diag(503, "Не удалось инициализировать клиент Subs Store", "subs_client_null");
  }

  const {
    data: { user },
  } = await sess.auth.getUser();
  if (!user) {
    return diag(401, "Войдите в аккаунт Subs Store", "unauthorized");
  }

  const { data, error } = await admin
    .from("notifications")
    .select("id,type,title,message,entity_type,entity_id,is_read,created_at")
    .eq("recipient_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    const msg = humanizeSubsSupabaseError(error.message);
    return diag(500, `Не удалось загрузить уведомления Subs Store: ${msg}`, "db_error");
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!isSubsPublicAuthConfigured() || !isSubsStoreBackendConfigured()) {
    return diag(503, "Subs Store не настроен", "subs_not_configured");
  }

  const sess = await createSubsAuthServerClient();
  const admin = createSubsStoreAdminClient();
  if (!sess || !admin) {
    return diag(503, "Не удалось инициализировать клиент Subs Store", "subs_client_null");
  }

  const {
    data: { user },
  } = await sess.auth.getUser();
  if (!user) {
    return diag(401, "Требуется вход", "unauthorized");
  }

  let body: { id?: string; mark_all?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return diag(400, "Неверный JSON", "bad_json");
  }

  if (body.mark_all) {
    const { error } = await admin
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_user_id", user.id)
      .eq("is_read", false);
    if (error) {
      return diag(500, humanizeSubsSupabaseError(error.message), "db_error");
    }
    return NextResponse.json({ ok: true });
  }

  const id = body.id?.trim();
  if (!id) {
    return diag(400, "id обязателен", "missing_id");
  }

  const { error } = await admin
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("recipient_user_id", user.id);

  if (error) {
    return diag(500, humanizeSubsSupabaseError(error.message), "db_error");
  }

  return NextResponse.json({ ok: true });
}
