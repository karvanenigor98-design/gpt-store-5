import { NextRequest, NextResponse } from "next/server";

import { resolveCustomerSiteSlug } from "@/lib/auth/resolveCustomerSiteSlug";
import { attachReferralIfEmpty, referralDbForSite, resolveReferrerByCode } from "@/lib/referrals/db";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { code?: string; site?: string };
  const rawCode = typeof body.code === "string" ? body.code.trim() : "";
  if (!rawCode) {
    return NextResponse.json({ error: "Нет кода" }, { status: 400 });
  }

  const siteSlug = await resolveCustomerSiteSlug({
    siteParam: body.site,
    pathname: request.nextUrl.pathname,
  });

  const { browserLike: supabase } = await createSiteSessionClient(siteSlug);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = referralDbForSite(siteSlug);
  if (!db) {
    return NextResponse.json({ error: "База не настроена" }, { status: 503 });
  }

  const referrer = await resolveReferrerByCode(db, rawCode);
  if (!referrer) {
    return NextResponse.json({ error: "Код не найден" }, { status: 404 });
  }

  const attached = await attachReferralIfEmpty(db, user.id, referrer.id);
  return NextResponse.json({ ok: true, attached });
}
