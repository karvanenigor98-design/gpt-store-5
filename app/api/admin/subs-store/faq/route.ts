import { NextRequest, NextResponse } from "next/server";

import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";

export async function GET() {
  const ctx = await requireSubsStaffContext({ adminOnly: true });
  if (ctx instanceof NextResponse) return ctx;

  const { data, error } = await ctx.subs
    .from("faq_items")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Не удалось загрузить FAQ" }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const ctx = await requireSubsStaffContext({ adminOnly: true });
  if (ctx instanceof NextResponse) return ctx;

  let body: { question?: string; answer?: string; is_active?: boolean; sort_order?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const question = body.question?.trim();
  const answer = body.answer?.trim();
  if (!question || !answer) {
    return NextResponse.json({ error: "Вопрос и ответ обязательны" }, { status: 400 });
  }

  const { data, error } = await ctx.subs
    .from("faq_items")
    .insert({
      question,
      answer,
      is_active: body.is_active !== false,
      sort_order: body.sort_order != null ? Math.round(body.sort_order) : 100,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Не удалось создать запись" }, { status: 400 });
  }
  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireSubsStaffContext({ adminOnly: true });
  if (ctx instanceof NextResponse) return ctx;

  let body: {
    id?: string;
    question?: string;
    answer?: string;
    is_active?: boolean;
    sort_order?: number;
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
  if (body.question !== undefined) patch.question = body.question.trim();
  if (body.answer !== undefined) patch.answer = body.answer.trim();
  if (body.is_active !== undefined) patch.is_active = body.is_active;
  if (body.sort_order != null && Number.isFinite(body.sort_order)) patch.sort_order = Math.round(body.sort_order);

  const { data, error } = await ctx.subs.from("faq_items").update(patch).eq("id", id).select("*").single();
  if (error || !data) {
    return NextResponse.json({ error: "Не удалось обновить" }, { status: 400 });
  }
  return NextResponse.json({ item: data });
}
