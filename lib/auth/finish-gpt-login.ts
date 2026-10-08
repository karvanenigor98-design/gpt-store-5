import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { applyGptSessionCookies } from "@/lib/auth/apply-gpt-session-cookies";
import { normalizeAuthReturnUrl } from "@/lib/auth/authReturnUrl";
import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { clearSiteUiLogout } from "@/lib/auth/siteUiSession";
import type { UserRole } from "@/types/database";

export function finishGptLoginResponse(input: {
  accessToken: string;
  refreshToken: string;
  user: User;
  expiresAt?: number;
  returnUrl: string;
}): NextResponse {
  const rawReturn = input.returnUrl || "/cabinet";
  const returnUrl =
    rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/cabinet";
  const effectiveReturnUrl = normalizeAuthReturnUrl(returnUrl, "gpt-store");

  const role: UserRole = fastStaffRoleFromEmail(input.user.email) ?? "client";

  const path = resolvePostLoginPath(effectiveReturnUrl, role);
  const res = NextResponse.json({ ok: true, path, role });
  applyGptSessionCookies(res, {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    user: input.user,
    expiresAt: input.expiresAt,
  });
  clearSiteUiLogout(res, "gpt-store");
  res.cookies.set("current_site", "gpt-store", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });
  return res;
}
