import { NextRequest, NextResponse } from "next/server";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { resolveServerRole } from "@/lib/auth/server-role";
import { applyGptStoreSiteFilter } from "@/lib/reviews/gpt-store-review-query";
import { revalidatePublicReviewPages } from "@/lib/reviews/revalidate-public-reviews";
import { createAdminClient, createClient } from "@/lib/supabase/server";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { user, admin: createAdminClient() };
}

/** Модерация отзывов GPT STORE (таблица reviews в GPT Supabase). */
export async function PATCH(req: NextRequest) {
  const ctx = await requireStaff();
  if (ctx instanceof NextResponse) return ctx;

  let body: {
    id?: string;
    action?: "approve" | "reject" | "delete";
    site?: string;
    rating?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id || !body.action) {
    return NextResponse.json({ error: "Нужны id и action" }, { status: 400 });
  }

  const siteSlug = body.site === "subs-store" ? "subs-store" : "gpt-store";
  const siteId = await getSiteUUID(siteSlug);

  if (body.action === "delete") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = applyGptStoreSiteFilter(
      (ctx.admin.from("reviews") as any).delete().eq("id", id),
      siteSlug,
      siteId,
    );
    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message ?? "Не удалось удалить отзыв" }, { status: 500 });
    }
    revalidatePublicReviewPages();
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "action: approve | reject | delete" }, { status: 400 });
  }

  if (body.action === "approve") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchQ = applyGptStoreSiteFilter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx.admin.from("reviews") as any).select("id, rating, content, site_id").eq("id", id),
      siteSlug,
      siteId,
    );
    const { data: existingRow } = await fetchQ.maybeSingle();
    const existing = existingRow as {
      id: string;
      rating: number | null;
      content: string;
      site_id?: string | null;
    } | null;
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
    const updatePayload: Record<string, unknown> = {
      status: "approved",
      rating,
      published_at: now,
      updated_at: now,
    };
    if (siteId && !existing.site_id) {
      updatePayload.site_id = siteId;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (ctx.admin.from("reviews") as any).update(updatePayload).eq("id", id);
    if (siteId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).or(`site_id.eq.${siteId},site_id.is.null`);
    }
    const { error } = (await query) as { error: { message?: string } | null };
    if (error) {
      return NextResponse.json({ error: error.message ?? "Не удалось обновить отзыв" }, { status: 500 });
    }
    revalidatePublicReviewPages();
    return NextResponse.json({ ok: true, status: "approved" });
  }

  const status = "rejected";
  const now = new Date().toISOString();

  const query = applyGptStoreSiteFilter(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ctx.admin.from("reviews") as any).update({ status, updated_at: now }).eq("id", id),
    siteSlug,
    siteId,
  );

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message ?? "Не удалось обновить отзыв" }, { status: 500 });
  }

  revalidatePublicReviewPages();

  return NextResponse.json({ ok: true, status });
}
