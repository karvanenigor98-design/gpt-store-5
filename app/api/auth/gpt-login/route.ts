import { NextRequest, NextResponse } from "next/server";

import { applyGptSessionCookies } from "@/lib/auth/apply-gpt-session-cookies";
import { authRateLimitUserMessage, isAuthRateLimitError } from "@/lib/auth/auth-rate-limit";
import { normalizeAuthReturnUrl } from "@/lib/auth/authReturnUrl";
import { gptPasswordGrant } from "@/lib/auth/gpt-password-grant";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { clearSiteUiLogout } from "@/lib/auth/siteUiSession";
import { syncProfileRoleForUser } from "@/lib/auth/syncProfileRole";
import { upsertSiteMembership } from "@/lib/auth/siteMembership";
import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { rememberGptStaffRole } from "@/lib/auth/resolve-gpt-staff-role";
import { tryCreateAdminClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export const maxDuration = 25;
export const runtime = "nodejs";

type Body = {
  email?: string;
  password?: string;
  returnUrl?: string;
};

async function peekGptProfileRole(userId: string): Promise<UserRole | null> {
  const admin = tryCreateAdminClient();
  if (!admin) return null;
  try {
    const query = admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    const timedOut = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 1_500);
    });
    const result = await Promise.race([query, timedOut]);
    if (!result || !("data" in result)) return null;
    const role = result.data?.role;
    if (role === "admin" || role === "operator" || role === "client") return role;
  } catch {
    /* login must not fail after a valid password */
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  const email = normalizeEmailForAuth(body.email ?? "");
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || password.length < 6) {
    return NextResponse.json(
      { error: "Укажите email и пароль (минимум 6 символов)." },
      { status: 400 },
    );
  }

  const rawReturn = body.returnUrl ?? "/cabinet";
  const returnUrl =
    rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/cabinet";
  const effectiveReturnUrl = normalizeAuthReturnUrl(returnUrl, "gpt-store");

  const grant = await gptPasswordGrant(email, password, 12_000);
  if (!grant.ok) {
    if (grant.message === "timeout" || grant.message === "auth_network") {
      return NextResponse.json(
        { error: "Сервер входа не ответил. Повторите попытку.", code: "auth_timeout" },
        { status: 503 },
      );
    }
    if (isAuthRateLimitError(grant.message)) {
      return NextResponse.json(
        { error: authRateLimitUserMessage(grant.message), code: "rate_limited" },
        { status: 429 },
      );
    }
    return NextResponse.json(
      {
        error: "Неверный email или пароль. Если забыли пароль — восстановите через /reset-password.",
        code: "invalid_credentials",
      },
      { status: 401 },
    );
  }

  const fastRole = fastStaffRoleFromEmail(grant.user.email ?? email);
  const peeked = fastRole ? null : await peekGptProfileRole(grant.user.id);
  const role: UserRole = fastRole ?? peeked ?? "client";
  if (role === "admin" || role === "operator") {
    rememberGptStaffRole(grant.user.id, role);
  }

  void syncProfileRoleForUser(grant.user.id, grant.user.email ?? email)
    .then((synced) => {
      const membershipRole: "customer" | "operator" | "admin" =
        synced === "admin" || synced === "operator" ? synced : "customer";
      return upsertSiteMembership(grant.user.id, "gpt-store", membershipRole);
    })
    .catch(() => undefined);

  const path = resolvePostLoginPath(effectiveReturnUrl, role);
  const res = NextResponse.json({ ok: true, path, role });
  applyGptSessionCookies(res, grant);
  clearSiteUiLogout(res, "gpt-store");
  res.cookies.set("current_site", "gpt-store", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });

  return res;
}
