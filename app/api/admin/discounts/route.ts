import { NextRequest, NextResponse } from "next/server";

import { humanizeSubsSupabaseError } from "@/lib/admin/subs-network-error";
import { isServerAdmin } from "@/lib/auth/server-role";
import { insertSubsDiscount, updateSubsDiscount } from "@/lib/admin/subs-discount-db";
import { mapSubsDiscountToUiRow } from "@/lib/admin/subs-commerce-map";
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { createAdminClient, createClient } from "@/lib/supabase/server";

function mapDiscountDbError(message: string, subsSite = false): string {
  const humanNet = humanizeSubsSupabaseError(message);
  if (humanNet !== (message ?? "").trim()) return humanNet;
  const m = message.toLowerCase();
  if (subsSite) {
    if (m.includes("relation") && m.includes("discounts") && m.includes("does not exist")) {
      return "Таблица discounts не создана в Subs Supabase. Выполните supabase/subs-store-migrations/003_discounts_promocodes_commerce.sql";
    }
    if (m.includes("tariff_slugs") && m.includes("does not exist")) {
      return "В Subs Supabase нет колонки tariff_slugs. Выполните supabase/subs-store-migrations/003_discounts_promocodes_commerce.sql";
    }
  }
  if (m.includes("relation") && m.includes("landing_discounts") && m.includes("does not exist")) {
    return "Таблица landing_discounts не создана в Supabase. Примените SQL из supabase/migrations/003_promocodes_discounts_client_stage.sql";
  }
  if (m.includes("column") && m.includes("does not exist")) {
    return subsSite
      ? "Схема таблицы discounts в Subs Supabase устарела. Примените subs-store-migrations/003_discounts_promocodes_commerce.sql"
      : "Схема таблицы landing_discounts устарела. Примените последнюю миграцию БД.";
  }
  if (m.includes("invalid input syntax") && m.includes("timestamp")) {
    return "Неверный формат даты в сроке действия скидки.";
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
      const { data, error } = await ctx.subs.from("discounts").select("*").order("created_at", { ascending: false });
      if (error) {
        return NextResponse.json({ error: mapDiscountDbError(error.message, true) }, { status: 500 });
      }
      return NextResponse.json({
        items: (data ?? []).map((r) => mapSubsDiscountToUiRow(r as Parameters<typeof mapSubsDiscountToUiRow>[0])),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: mapDiscountDbError(msg, true) }, { status: 500 });
    }
  }

  const admin = createAdminClient();

  // site_id on landing_discounts is TEXT (from migration 006_site_memberships).
  // Filter by text slug directly — no UUID conversion needed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin.from("landing_discounts") as any)
    .select("*")
    .order("created_at", { ascending: false })
    .eq("site_id", siteSlug);

  if (error) {
    // If site_id column doesn't exist yet — return all (migration not applied)
    if (error.message?.includes("column") && error.message?.includes("site_id")) {
      const { data: all, error: allErr } = await admin
        .from("landing_discounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (allErr) return NextResponse.json({ error: mapDiscountDbError(allErr.message) }, { status: 500 });
      return NextResponse.json({ items: all ?? [] });
    }
    return NextResponse.json({ error: mapDiscountDbError(error.message) }, { status: 500 });
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
    name?: string;
    discount_type?: "percent" | "fixed";
    discount_value?: number;
    applies_to?: string;
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

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Укажите название" }, { status: 400 });
  }
  const discountType = body.discount_type === "fixed" ? "fixed" : "percent";
  const value = Number(body.discount_value);
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Укажите размер скидки" }, { status: 400 });
  }
  const appliesTo = (body.applies_to ?? "all").trim() || "all";

  // Resolve site slug from body — TEXT column
  const siteSlug =
    body.site_id === "subs-store" || body.site_id === "gpt-store" ? body.site_id : "gpt-store";

  if (siteSlug === "subs-store") {
    const ctx = await requireSubsStaffContext({ adminOnly: true });
    if (ctx instanceof NextResponse) return ctx;
    const tariffSlugs =
      appliesTo === "all" || appliesTo === "landing" ?
        null
      : appliesTo.split(",").map((s) => s.trim()).filter(Boolean);
    const { data: created, error } = await insertSubsDiscount(ctx.subs, {
      title: name,
      type: discountType,
      value: Math.round(value),
      appliesTo,
      tariffSlugs,
      starts_at: body.valid_from ?? null,
      ends_at: body.valid_until ?? null,
      is_active: body.is_active !== false,
    });
    if (error || !created) {
      return NextResponse.json(
        { error: mapDiscountDbError(error?.message ?? "Не удалось создать скидку", true) },
        { status: 400 },
      );
    }
    return NextResponse.json({ item: mapSubsDiscountToUiRow(created as Parameters<typeof mapSubsDiscountToUiRow>[0]) });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (admin.from("landing_discounts") as any)
    .insert({
      name,
      discount_type: discountType,
      discount_value: Math.round(value),
      applies_to: appliesTo,
      valid_from: body.valid_from ?? null,
      valid_until: body.valid_until ?? null,
      is_active: body.is_active !== false,
      site_id: siteSlug,
    })
    .select("*")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: mapDiscountDbError(error?.message ?? "Не удалось создать скидку") }, { status: 400 });
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
    name?: string;
    discount_type?: "percent" | "fixed";
    discount_value?: number;
    applies_to?: string;
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
    name?: string;
    discount_type?: "percent" | "fixed";
    discount_value?: number;
    applies_to?: string;
    valid_from?: string | null;
    valid_until?: string | null;
    is_active?: boolean;
  } = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.discount_type) patch.discount_type = body.discount_type === "fixed" ? "fixed" : "percent";
  if (body.discount_value != null && Number.isFinite(body.discount_value)) {
    patch.discount_value = Math.round(Number(body.discount_value));
  }
  if (body.applies_to !== undefined) patch.applies_to = body.applies_to.trim() || "all";
  if (body.valid_from !== undefined) patch.valid_from = body.valid_from;
  if (body.valid_until !== undefined) patch.valid_until = body.valid_until;
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  if (siteSlug === "subs-store") {
    const ctx = await requireSubsStaffContext({ adminOnly: true });
    if (ctx instanceof NextResponse) return ctx;
    const patchSubs: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name !== undefined) patchSubs.title = body.name.trim();
    if (body.discount_type) patchSubs.type = body.discount_type === "fixed" ? "fixed" : "percent";
    if (body.discount_value != null && Number.isFinite(body.discount_value)) {
      patchSubs.value = Math.round(Number(body.discount_value));
    }
    if (body.valid_from !== undefined) patchSubs.starts_at = body.valid_from;
    if (body.valid_until !== undefined) patchSubs.ends_at = body.valid_until;
    if (body.is_active !== undefined) patchSubs.is_active = body.is_active;
    let tariffSlugs: string[] | null | undefined;
    let appliesTo: string | undefined;
    if (body.applies_to !== undefined) {
      appliesTo = body.applies_to.trim() || "all";
      if (appliesTo === "all" || appliesTo === "landing") {
        tariffSlugs = null;
      } else {
        tariffSlugs = appliesTo.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    const { data: updated, error } = await updateSubsDiscount(ctx.subs, id, patchSubs, {
      tariffSlugs,
      appliesTo,
    });
    if (error || !updated) {
      return NextResponse.json(
        { error: mapDiscountDbError(error?.message ?? "Не удалось обновить", true) },
        { status: 400 },
      );
    }
    return NextResponse.json({ item: mapSubsDiscountToUiRow(updated as Parameters<typeof mapSubsDiscountToUiRow>[0]) });
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("landing_discounts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: mapDiscountDbError(error?.message ?? "Не удалось обновить") }, { status: 400 });
  }

  return NextResponse.json({ item: updated });
}
