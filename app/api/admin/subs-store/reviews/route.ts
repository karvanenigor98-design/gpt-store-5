import { NextRequest, NextResponse } from "next/server";

import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { revalidatePublicReviewPages } from "@/lib/reviews/revalidate-public-reviews";

/** Модерация отзывов Subs Store (таблица reviews: name, text, is_published, status). */
export async function PATCH(req: NextRequest) {
  const ctx = await requireSubsStaffContext({ adminOnly: true });
  if (ctx instanceof NextResponse) return ctx;

  let body: { id?: string; action?: "approve" | "reject" | "delete"; rating?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id || !body.action) {
    return NextResponse.json({ error: "Нужны id и action" }, { status: 400 });
  }

  if (body.action === "delete") {
    const { error } = await ctx.subs.from("reviews").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Не удалось удалить отзыв" }, { status: 500 });
    }
    revalidatePublicReviewPages();
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "action: approve | reject | delete" }, { status: 400 });
  }

  if (body.action === "approve") {
    const { data: existing } = await ctx.subs
      .from("reviews")
      .select("id, rating")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
    }

    let rating =
      body.rating != null && Number.isFinite(body.rating)
        ? Math.min(5, Math.max(1, Math.round(Number(body.rating))))
        : null;
    if (rating == null && existing.rating != null && Number.isFinite(existing.rating)) {
      rating = Math.min(5, Math.max(1, Math.round(Number(existing.rating))));
    }
    if (rating == null) {
      return NextResponse.json(
        { error: "Перед публикацией выберите рейтинг." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const updateRow: Record<string, unknown> = {
      status: "approved",
      is_published: true,
      rating,
      updated_at: now,
    };

    let { error } = await ctx.subs.from("reviews").update(updateRow).eq("id", id);

    if (error?.message?.toLowerCase().includes("published_at")) {
      const retry = await ctx.subs
        .from("reviews")
        .update({
          status: "approved",
          is_published: true,
          rating,
          updated_at: now,
        })
        .eq("id", id);
      error = retry.error;
    }

    if (error) {
      return NextResponse.json({ error: "Не удалось обновить отзыв" }, { status: 500 });
    }
    revalidatePublicReviewPages();
    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();
  const { error } = await ctx.subs
    .from("reviews")
    .update({
      status: "rejected",
      is_published: false,
      updated_at: now,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Не удалось обновить отзыв" }, { status: 500 });
  }

  revalidatePublicReviewPages();

  return NextResponse.json({ ok: true });
}
