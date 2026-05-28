import { NextRequest, NextResponse } from "next/server";

import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { getEmailConfirmationState } from "@/lib/auth/get-auth-user-by-email";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";

export async function GET(req: NextRequest) {
  const email = normalizeEmailForAuth(req.nextUrl.searchParams.get("email") ?? "");
  const siteParam = req.nextUrl.searchParams.get("site");
  const site: AuthSiteSlug = siteParam === "subs-store" ? "subs-store" : "gpt-store";

  if (!email) {
    return NextResponse.json({ exists: false, emailConfirmed: false });
  }

  const state = await getEmailConfirmationState(email, site);
  return NextResponse.json(state);
}
