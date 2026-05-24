import { NextRequest, NextResponse } from "next/server";

import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getReferralSettings, referralDbForSite, updateReferralSettings } from "@/lib/referrals/db";
import { resolveServerRole } from "@/lib/auth/server-role";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await resolveServerRole(user);
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const siteSlug = resolveAdminSiteSlug({ site: request.nextUrl.searchParams.get("site") ?? undefined });
  const db = referralDbForSite(siteSlug);
  if (!db) return NextResponse.json({ error: "База не настроена" }, { status: 503 });

  const settings = await getReferralSettings(db);
  return NextResponse.json({ settings, siteSlug });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await resolveServerRole(user);
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    site?: string;
    refereeDiscountPercent?: number;
    referrerDiscountPercent?: number;
  };
  const siteSlug = resolveAdminSiteSlug({ site: body.site });
  const db = referralDbForSite(siteSlug);
  if (!db) return NextResponse.json({ error: "База не настроена" }, { status: 503 });

  const settings = await updateReferralSettings(db, {
    refereeDiscountPercent: body.refereeDiscountPercent,
    referrerDiscountPercent: body.referrerDiscountPercent,
  });
  return NextResponse.json({ settings, siteSlug });
}
