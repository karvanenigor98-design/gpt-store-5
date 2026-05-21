import { NextRequest, NextResponse } from "next/server";

import { isServerAdmin } from "@/lib/auth/server-role";
import { insertSubsPromocode, updateSubsPromocode } from "@/lib/admin/subs-discount-db";
import { mapSubsPromocodeToUiRow } from "@/lib/admin/subs-commerce-map";
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { humanizeSubsSupabaseError } from "@/lib/admin/subs-network-error";
import { createAdminClient, createClient } from "@/lib/supabase/server";

function mapPromoDbError(message: string, subsSite = false): string {
  if (subsSite) {
    const human = humanizeSubsSupabaseError(message);
    if (human !== (message ?? "").trim()) return human;
  }
  const m = message.toLowerCase();
  if (m.includes("relation") && m.includes("promocodes") && m.includes("does not exist")) {
    return "Таблица promocodes не создана в Supabase. Примените SQL-миграцию supabase/migrations/003_promocodes_discounts_client_stage.sql";
  }
  if (m.includes("column") && m.includes("does not exist")) {
    return "Схема таблицы promocodes устарела. Примените последнюю миграцию БД.";
  }
  if (m.includes("invalid input syntax") && m.includes("timestamp")) {
    return "Неверный формат даты в сроке действия промокода.";
  }
  if (m.includes("unique")) {
    return "Такой код уже есть";
  }
  return message || "Ошибка базы данных";
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await isServerAdmin(user))) {
    return NextResponse.json({ error: "Только администратор" }, { status: 403 });
  }

  const siteSlug = req.nextUrl.searchParams.get("site") ?? "gpt-store";

  if (siteSlug === "subs-store") {
    const ctx = await requireSubsStaffContext({ adminOnly: true });
    if (ctx instanceof NextResponse) return ctx;
    try {
      const { data, error } = await ctx.subs.from("promocodes").select("*").order("created_at", { ascending: false });
      if (error) {
        return NextResponse.json({ error: mapPromoDbError(error.message, true) }, { status: 500 });
      }
      return NextResponse.json({
        items: (data ?? []).map((r) => mapSubsPromocodeToUiRow(r as Parameters<typeof mapSubsPromocodeToUiRow>[0])),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: mapPromoDbError(msg, true) }, { status: 500 });
    }
  }

  const admin = createAdminClient();

  // site_id on promocodes is TEXT (from migration 006_site_memberships).
  // We filter by text slug directly — no UUID conversion needed here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from("promocodes") as any)
    .select("*")
    .order("created_at", { ascending: false })
    .eq("site_id", siteSlug);

  if (error) {
    // If site_id column doesn't exist yet — return all (migration not applied)
    if (error.message?.includes("column") && error.message?.includes("site_id")) {
      const { data: all, error: allErr } = await admin
        .from("promocodes")
        .select("*")
        .order("created_at", { ascending: false });
      if (allErr) return NextResponse.json({ error: mapPromoDbError(allErr.message) }, { status: 500 });
      return NextResponse.json({ items: all ?? [] });
    }
    return NextResponse.json({ error: mapPromoDbError(error.message) }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await isServerAdmin(user))) {
    return NextResponse.json({ error: "Только администратор" }, { status: 403 });
  }

  let body: {
    code?: string;
    discount_type?: "percent" | "fixed";
    discount_value?: number;
    plan_ids?: string[] | null;
    max_uses?: number | null;
    valid_from?: string | null;
    valid_until?: string | null;
    is_active?: boolean;
    site_id?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const code = body.code?.trim().toUpperCase();
  if (!code || code.length < 2) {
    return NextResponse.json({ error: "Укажите код (от 2 символов)" }, { status: 400 });
  }
  const discountType = body.discount_type === "fixed" ? "fixed" : "percent";
  const value = Number(body.discount_value);
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Укажите размер скидки" }, { status: 400 });
  }

  // Resolve site slug from body — TEXT column, no UUID conversion needed
  const siteSlug =
    body.site_id === "subs-store" || body.site_id === "gpt-store" ? body.site_id : "gpt-store";

  if (siteSlug === "subs-store") {
    const ctx = await requireSubsStaffContext({ adminOnly: true });
    if (ctx instanceof NextResponse) return ctx;
    const expiresAt =
      body.valid_until && String(body.valid_until).trim() ?
        new Date(String(body.valid_until)).toISOString()
      : null;
    const { data: created, error } = await insertSubsPromocode(
      ctx.subs,
      {
        code,
        type: discountType,
        value: Math.round(value),
        max_uses: body.max_uses ?? null,
        used_count: 0,
        expires_at: expiresAt,
        is_active: body.is_active !== false,
      },
      body.plan_ids?.length ? body.plan_ids : null,
    );
    if (error || !created) {
      return NextResponse.json({ error: mapPromoDbError(error?.message ?? "Не удалось создать") }, { status: 400 });
    }
    return NextResponse.json({ item: mapSubsPromocodeToUiRow(created as Parameters<typeof mapSubsPromocodeToUiRow>[0]) });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (admin.from("promocodes") as any)
    .insert({
      code,
      discount_type: discountType,
      discount_value: Math.round(value),
      plan_ids: body.plan_ids?.length ? body.plan_ids : null,
      max_uses: body.max_uses ?? null,
      valid_from: body.valid_from ?? null,
      valid_until: body.valid_until ?? null,
      is_active: body.is_active !== false,
      site_id: siteSlug,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: mapPromoDbError(error.message) }, { status: 400 });
  }

  return NextResponse.json({ item: created });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!(await isServerAdmin(user))) {
    return NextResponse.json({ error: "Только администратор" }, { status: 403 });
  }

  const siteSlug = req.nextUrl.searchParams.get("site") ?? "gpt-store";

  let body: {
    id?: string;
    discount_type?: "percent" | "fixed";
    discount_value?: number;
    plan_ids?: string[] | null;
    max_uses?: number | null;
    valid_from?: string | null;
    valid_until?: string | null;
    is_active?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  const patch: {
    updated_at: string;
    discount_type?: "percent" | "fixed";
    discount_value?: number;
    plan_ids?: string[] | null;
    max_uses?: number | null;
    valid_from?: string | null;
    valid_until?: string | null;
    is_active?: boolean;
  } = { updated_at: new Date().toISOString() };
  if (body.discount_type) patch.discount_type = body.discount_type === "fixed" ? "fixed" : "percent";
  if (body.discount_value != null && Number.isFinite(body.discount_value)) {
    patch.discount_value = Math.round(Number(body.discount_value));
  }
  if (body.plan_ids !== undefined) patch.plan_ids = body.plan_ids?.length ? body.plan_ids : null;
  if (body.max_uses !== undefined) patch.max_uses = body.max_uses;
  if (body.valid_from !== undefined) patch.valid_from = body.valid_from;
  if (body.valid_until !== undefined) patch.valid_until = body.valid_until;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  if (siteSlug === "subs-store") {
    const ctx = await requireSubsStaffContext({ adminOnly: true });
    if (ctx instanceof NextResponse) return ctx;
    const patchSubs: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.discount_type) patchSubs.type = body.discount_type === "fixed" ? "fixed" : "percent";
    if (body.discount_value != null && Number.isFinite(body.discount_value)) {
      patchSubs.value = Math.round(Number(body.discount_value));
    }
    if (body.max_uses !== undefined) patchSubs.max_uses = body.max_uses;
    if (body.valid_until !== undefined) {
      patchSubs.expires_at =
        body.valid_until && String(body.valid_until).trim() ?
          new Date(String(body.valid_until)).toISOString()
        : null;
    }
    if (body.is_active !== undefined) patchSubs.is_active = body.is_active;
    const planIds = body.plan_ids !== undefined ? (body.plan_ids?.length ? body.plan_ids : null) : undefined;
    const { data: updated, error } = await updateSubsPromocode(ctx.subs, id, patchSubs, planIds);
    if (error || !updated) {
      return NextResponse.json({ error: mapPromoDbError(error?.message ?? "Не удалось обновить") }, { status: 400 });
    }
    return NextResponse.json({ item: mapSubsPromocodeToUiRow(updated as Parameters<typeof mapSubsPromocodeToUiRow>[0]) });
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin.from("promocodes").update(patch).eq("id", id).select("*").single();

  if (error || !updated) {
    return NextResponse.json({ error: mapPromoDbError(error?.message ?? "Не удалось обновить") }, { status: 400 });
  }

  return NextResponse.json({ item: updated });
}
