import { NextRequest, NextResponse } from "next/server";

import { buildCustomerOrdersListHref } from "@/lib/dashboard/customer-order-view";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

function resolveSiteSlug(raw: string | null): SiteSlug | null {
  if (raw === "gpt-store" || raw === "subs-store") return raw;
  return null;
}

export async function GET(request: NextRequest) {
  const siteSlug = resolveSiteSlug(request.nextUrl.searchParams.get("site"));
  if (!siteSlug) {
    return NextResponse.json({ error: "Укажите site=gpt-store или site=subs-store" }, { status: 400 });
  }

  const ordersPath = buildCustomerOrdersListHref(siteSlug);

  let user: { id: string; email?: string | null } | null = null;
  try {
    const { browserLike } = await createSiteSessionClient(siteSlug);
    const { data } = await browserLike.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user) {
    const returnUrl = encodeURIComponent(ordersPath);
    return NextResponse.json({
      authenticated: false,
      href: `/login?site=${siteSlug}&returnUrl=${returnUrl}`,
    });
  }

  return NextResponse.json({
    authenticated: true,
    href: ordersPath,
  });
}
