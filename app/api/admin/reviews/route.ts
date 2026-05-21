import { NextRequest, NextResponse } from "next/server";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { resolveServerRole } from "@/lib/auth/server-role";
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

  let body: { id?: string; action?: "approve" | "reject" | "delete"; site?: string };
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
    let query = ctx.admin.from("reviews").delete().eq("id", id);
    if (siteId) {
      query = query.eq("site_id", siteId) as typeof query;
    }
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

  const status = body.action === "approve" ? "approved" : "rejected";

  let query = ctx.admin.from("reviews").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (siteId) {
    query = query.eq("site_id", siteId) as typeof query;
  }

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message ?? "Не удалось обновить отзыв" }, { status: 500 });
  }

  revalidatePublicReviewPages();

  return NextResponse.json({ ok: true, status });
}
