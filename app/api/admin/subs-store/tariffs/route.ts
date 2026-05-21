import { NextRequest, NextResponse } from "next/server";

import { humanizeSubsSupabaseError } from "@/lib/admin/subs-network-error";
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";

/** Список тарифов Subs Store (slug, title, price) для промокодов и страницы /admin/tariffs — чтение доступно операторам. */
export async function GET() {
  const ctx = await requireSubsStaffContext();
  if (ctx instanceof NextResponse) return ctx;

  const { data, error } = await ctx.subs
    .from("tariffs")
    .select(
      "id,slug,title,price,old_price,category,badge,description,short_description,duration_months,monthly_price,savings_text,is_popular,is_best_value,is_active,sort_order,cta_text,allow_promocodes,allow_discounts,updated_at",
    )
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: humanizeSubsSupabaseError(error.message) }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireSubsStaffContext({ adminOnly: true });
  if (ctx instanceof NextResponse) return ctx;

  let body: {
    id?: string;
    price?: number;
    old_price?: number | null;
    title?: string;
    description?: string | null;
    short_description?: string | null;
    duration_months?: number | null;
    monthly_price?: number | null;
    savings_text?: string | null;
    is_popular?: boolean;
    is_best_value?: boolean;
    is_active?: boolean;
    sort_order?: number;
    badge?: string | null;
    cta_text?: string | null;
    allow_promocodes?: boolean;
    allow_discounts?: boolean;
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

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.price != null && Number.isFinite(body.price)) patch.price = Math.round(Number(body.price));
  if (body.old_price !== undefined) patch.old_price = body.old_price == null ? null : Math.round(Number(body.old_price));
  if (body.title !== undefined) patch.title = body.title.trim();
  if (body.is_active !== undefined) patch.is_active = body.is_active;
  if (body.sort_order != null && Number.isFinite(body.sort_order)) patch.sort_order = Math.round(Number(body.sort_order));
  if (body.badge !== undefined) patch.badge = body.badge;
  if (body.description !== undefined) patch.description = body.description;
  if (body.short_description !== undefined) patch.short_description = body.short_description;
  if (body.duration_months !== undefined) {
    patch.duration_months =
      body.duration_months == null ? null : Math.round(Number(body.duration_months));
  }
  if (body.monthly_price !== undefined) {
    patch.monthly_price = body.monthly_price == null ? null : Math.round(Number(body.monthly_price));
  }
  if (body.savings_text !== undefined) patch.savings_text = body.savings_text;
  if (body.is_popular !== undefined) patch.is_popular = body.is_popular;
  if (body.is_best_value !== undefined) patch.is_best_value = body.is_best_value;
  if (body.cta_text !== undefined) patch.cta_text = body.cta_text;
  if (body.allow_promocodes !== undefined) patch.allow_promocodes = body.allow_promocodes;
  if (body.allow_discounts !== undefined) patch.allow_discounts = body.allow_discounts;

  const { data, error } = await ctx.subs.from("tariffs").update(patch).eq("id", id).select("*").single();
  if (error || !data) {
    return NextResponse.json({ error: "Не удалось обновить тариф" }, { status: 400 });
  }
  return NextResponse.json({ item: data });
}
