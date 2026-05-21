import { NextRequest, NextResponse } from "next/server";

import { isServerAdmin } from "@/lib/auth/server-role";
import {
  getSiteEmailSettings,
  saveSiteEmailSettings,
  type SiteEmailNotificationSettings,
} from "@/lib/email/settings";
import { createClient } from "@/lib/supabase/server";
import type { SiteSlug } from "@/lib/sites";

function parseSite(raw: string | null): SiteSlug | null {
  if (raw === "gpt-store" || raw === "subs-store") return raw;
  return null;
}

export async function GET(req: NextRequest) {
  const site = parseSite(req.nextUrl.searchParams.get("site"));
  if (!site) {
    return NextResponse.json({ error: "Укажите site=gpt-store или subs-store" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isServerAdmin(user))) {
    return NextResponse.json({ error: "Только администратор" }, { status: 403 });
  }

  const settings = await getSiteEmailSettings(site);
  return NextResponse.json({ site, settings });
}

export async function POST(req: NextRequest) {
  const site = parseSite(req.nextUrl.searchParams.get("site"));
  if (!site) {
    return NextResponse.json({ error: "Укажите site=gpt-store или subs-store" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isServerAdmin(user))) {
    return NextResponse.json({ error: "Только администратор" }, { status: 403 });
  }

  let body: Partial<SiteEmailNotificationSettings>;
  try {
    body = (await req.json()) as Partial<SiteEmailNotificationSettings>;
  } catch {
    return NextResponse.json({ error: "Неверный JSON" }, { status: 400 });
  }

  const current = await getSiteEmailSettings(site);
  const merged: SiteEmailNotificationSettings = { ...current, ...body };
  const result = await saveSiteEmailSettings(site, merged);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Не удалось сохранить настройки email-уведомлений" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, settings: merged });
}
