import { NextRequest, NextResponse } from "next/server";

import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";

/** Subs notifications — другая схема, без site_id. */
export async function GET() {
  const ctx = await requireSubsStaffContext();
  if (ctx instanceof NextResponse) return ctx;

  const query = ctx.subs.from("notifications").select("*").order("created_at", { ascending: false }).limit(120);

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
  const ctx = await requireSubsStaffContext();
  if (ctx instanceof NextResponse) return ctx;

  let body: { id?: string; mark_all?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  if (body.mark_all) {
    await ctx.subs.from("notifications").update({ is_read: true }).eq("is_read", false);
    return NextResponse.json({ ok: true });
  }

  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id обязателен" }, { status: 400 });
  }

  const { error } = await ctx.subs.from("notifications").update({ is_read: true }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Не удалось обновить" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
