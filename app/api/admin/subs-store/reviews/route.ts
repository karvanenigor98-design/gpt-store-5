import { NextRequest, NextResponse } from "next/server";

import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import { revalidatePublicReviewPages } from "@/lib/reviews/revalidate-public-reviews";

/** Модерация отзывов Subs Store (таблица reviews: name, text, is_published, status). */
export async function PATCH(req: NextRequest) {
  const ctx = await requireSubsStaffContext({ adminOnly: true });
  if (ctx instanceof NextResponse) return ctx;

  let body: { id?: string; action?: "approve" | "reject" | "delete" };
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

  const published = body.action === "approve";
  const status = published ? "approved" : "rejected";

  const { error } = await ctx.subs
    .from("reviews")
    .update({
      status,
      is_published: published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Не удалось обновить отзыв" }, { status: 500 });
  }

  revalidatePublicReviewPages();

  return NextResponse.json({ ok: true });
}
