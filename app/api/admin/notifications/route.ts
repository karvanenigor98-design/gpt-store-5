import { NextRequest, NextResponse } from "next/server";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { resolveServerRole } from "@/lib/auth/server-role";
import { createAdminClient, createClient } from "@/lib/supabase/server";

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { user, admin: createAdminClient() };
}

/** GPT Store notifications (таблица в GPT Supabase). Subs — /api/admin/subs-store/notifications */
export async function GET(req: NextRequest) {
  const ctx = await requireStaff();
  if (ctx instanceof NextResponse) return ctx;

  const siteSlug = req.nextUrl.searchParams.get("site") === "subs-store" ? "subs-store" : "gpt-store";
  const siteId = await getSiteUUID(siteSlug);

  let query = ctx.admin.from("notifications").select("*").order("created_at", { ascending: false }).limit(120);

  if (siteId) {
    if (siteSlug === "gpt-store") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).or(`site_id.eq.${siteId},site_id.is.null`) as typeof query;
    } else {
      query = query.eq("site_id", siteId);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Не удалось загрузить уведомления" }, { status: 500 });
  }

  const items = (data ?? []).filter((row) => {
    const t = (row as { type?: string }).type;
    return t !== "chat_reply";
  });

  return NextResponse.json({ items: items.slice(0, 100) });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireStaff();
  if (ctx instanceof NextResponse) return ctx;

  let body: { id?: string; mark_all?: boolean; site?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const siteSlug = body.site === "subs-store" ? "subs-store" : "gpt-store";
  const siteId = await getSiteUUID(siteSlug);

  if (body.mark_all) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = ctx.admin.from("notifications").update({ is_read: true }).eq("is_read", false);
    if (siteId) {
      if (siteSlug === "gpt-store") {
        q = q.or(`site_id.eq.${siteId},site_id.is.null`);
      } else {
        q = q.eq("site_id", siteId);
      }
    }
    const { error } = await q;
    if (error) {
      return NextResponse.json({ error: "Не удалось обновить" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  const { error } = await ctx.admin.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Не удалось обновить" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
