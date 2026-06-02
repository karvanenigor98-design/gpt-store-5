import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { profileRoleToSiteMembershipRole } from "@/lib/auth/staffRoleRestore";
import { upsertSiteMembership } from "@/lib/auth/siteMembership";
import { syncProfileRoleForUser } from "@/lib/auth/syncProfileRole";
import { syncSubsProfileRoleForUser } from "@/lib/auth/subsProfileSync";
import { clearSiteUiLogout, type SiteSlug } from "@/lib/auth/siteUiSession";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";

export async function POST(req: NextRequest) {
  let siteSlug = "gpt-store";
  try {
    const body = (await req.json()) as { site?: string };
    if (body.site === "subs-store" || body.site === "gpt-store") {
      siteSlug = body.site;
    }
  } catch {
    /* default */
  }

  if (siteSlug === "subs-store") {
    const subsAuth = await createSubsAuthServerClient();
    const { data: { user } } = await subsAuth?.auth.getUser() ?? { data: { user: null } };
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      await syncSubsProfileRoleForUser(user.id, user.email ?? null);
    } catch {
      /* не блокируем вход */
    }
    const res = NextResponse.json({ ok: true, site: siteSlug });
    clearSiteUiLogout(res, siteSlug as SiteSlug);
    return res;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let membershipRole: "customer" | "operator" | "admin" = "customer";
  try {
    const profileRole = await syncProfileRoleForUser(user.id, user.email ?? null);
    membershipRole = profileRoleToSiteMembershipRole(profileRole);
  } catch {
    /* не блокируем вход */
  }

  await upsertSiteMembership(user.id, siteSlug, membershipRole);

  const res = NextResponse.json({ ok: true, site: siteSlug });
  clearSiteUiLogout(res, siteSlug as SiteSlug);
  return res;
}
