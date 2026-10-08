import { NextRequest, NextResponse } from "next/server";

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
import { createGptRouteAuthClient } from "@/lib/supabase/route-auth-client";
import type { UserRole } from "@/types/database";

export const maxDuration = 20;
export const runtime = "nodejs";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

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
      setTimeout(() => resolve(null), 2_000);
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

  const grant = await gptPasswordGrant(email, password, 10_000);
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

  let routeAuth: Awaited<ReturnType<typeof createGptRouteAuthClient>>;
  try {
    routeAuth = await createGptRouteAuthClient();
  } catch {
    return NextResponse.json({ error: "Auth не настроен на сервере" }, { status: 503 });
  }
  const { supabase, applyCookies } = routeAuth;

  const sessionSet = await withTimeout(
    supabase.auth.setSession({
      access_token: grant.accessToken,
      refresh_token: grant.refreshToken,
    }),
    4_000,
    { data: { user: null, session: null }, error: { message: "timeout" } } as Awaited<
      ReturnType<typeof supabase.auth.setSession>
    >,
  );

  if (sessionSet.error?.message === "timeout" || !sessionSet.data.session) {
    const res = NextResponse.json(
      { error: "Сессия не записалась. Повторите вход.", code: "session_write_timeout" },
      { status: 503 },
    );
    applyCookies(res);
    return res;
  }

  const user = sessionSet.data.user ?? grant.user;
  const fastRole = fastStaffRoleFromEmail(user.email);
  const peeked = fastRole ? null : await peekGptProfileRole(user.id);
  const role: UserRole = fastRole ?? peeked ?? "client";
  if (role === "admin" || role === "operator") {
    rememberGptStaffRole(user.id, role);
  }

  void syncProfileRoleForUser(user.id, user.email ?? null)
    .then((synced) => {
      const membershipRole: "customer" | "operator" | "admin" =
        synced === "admin" || synced === "operator" ? synced : "customer";
      return upsertSiteMembership(user.id, "gpt-store", membershipRole);
    })
    .catch(() => undefined);

  const path = resolvePostLoginPath(effectiveReturnUrl, role);
  const res = NextResponse.json({ ok: true, path, role });
  applyCookies(res);
  clearSiteUiLogout(res, "gpt-store");
  res.cookies.set("current_site", "gpt-store", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });

  return res;
}
