import { NextRequest, NextResponse } from "next/server";

import { humanizeSubsSupabaseError } from "@/lib/admin/subs-network-error";
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";

export async function POST(req: NextRequest) {
  const ctx = await requireSubsStaffContext({ adminOnly: true });
  if (ctx instanceof NextResponse) return ctx;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const rows = Object.entries(body).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
    updated_at: new Date().toISOString(),
  }));

  for (const row of rows) {
    const { error } = await ctx.subs.from("site_settings").upsert(row, { onConflict: "key" });
    if (error) {
      return NextResponse.json(
        { error: humanizeSubsSupabaseError(error.message) },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
