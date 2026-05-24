import { NextRequest, NextResponse } from "next/server";

import { resolveCustomerSiteSlug } from "@/lib/auth/resolveCustomerSiteSlug";
import { referralDbForSite } from "@/lib/referrals/db";
import { fetchReferralMe } from "@/lib/referrals/me";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: NextRequest) {
  const siteParam = request.nextUrl.searchParams.get("site");
  const siteSlug = await resolveCustomerSiteSlug({
    siteParam,
    pathname: "/dashboard",
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

  const payload = await fetchReferralMe(db, siteSlug, user.id, APP_URL);
  if (!payload) {
    return NextResponse.json({ error: "Не удалось получить реферальную ссылку" }, { status: 500 });
  }

  return NextResponse.json(payload);
}
