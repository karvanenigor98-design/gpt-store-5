import { NextRequest, NextResponse } from "next/server";

import { getLandingNavSession } from "@/lib/auth/landing-nav-session";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

function parseSite(raw: string | null): SiteSlug | null {
  return raw === "subs-store" || raw === "gpt-store" ? raw : null;
}

export async function GET(request: NextRequest) {
  const site = parseSite(request.nextUrl.searchParams.get("site"));
  if (!site) {
    return NextResponse.json({ ok: false, error: "invalid site" }, { status: 400 });
  }

  const session = await getLandingNavSession(site);
  return NextResponse.json({
    ok: true,
    site,
    loggedIn: session.loggedIn,
    emailConfirmed: session.emailConfirmed,
  });
}
