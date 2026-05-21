import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isServerAdmin } from "@/lib/auth/server-role";
import { requireSubsStaffContext } from "@/lib/admin/subs-api-guard";
import type { Json } from "@/types/database";

type Payload = {
  auto_reply_delay_minutes?: number;
  operator_telegram_url?: string;
  night_start_hour?: number;
  night_end_hour?: number;
  pricing_plans?: unknown;
  promo_codes?: unknown;
  landing_sections?: unknown;
  plan_availability?: unknown;
  seoTitle?: string;
  seoDescription?: string;
  supportUsername?: string;
  spotify_account_data_notice?: string;
};

export async function POST(request: NextRequest) {
  try {
    const site = request.nextUrl.searchParams.get("site")?.trim();
    if (site === "subs-store") {
      const ctx = await requireSubsStaffContext({ adminOnly: true });
      if (ctx instanceof NextResponse) return ctx;

      const body = (await request.json()) as Payload;
      const entries = Object.entries(body).filter(([, value]) => value !== undefined);
      if (!entries.length) return NextResponse.json({ ok: true });

      for (const [key, value] of entries) {
        const { error } = await ctx.subs.from("site_settings").upsert({ key, value: value as Json });
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
      }
      return NextResponse.json({ ok: true });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isServerAdmin(user))) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = (await request.json()) as Payload;
    const entries = Object.entries(body).filter(([, value]) => value !== undefined);

    if (!entries.length) return NextResponse.json({ ok: true });

    const admin = createAdminClient();
    for (const [key, value] of entries) {
      const { error } = await admin.from("site_settings").upsert({ key, value: value as Json });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
