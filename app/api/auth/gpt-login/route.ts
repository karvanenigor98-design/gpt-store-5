import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { authRateLimitUserMessage, isAuthRateLimitError } from "@/lib/auth/auth-rate-limit";
import { normalizeAuthReturnUrl } from "@/lib/auth/authReturnUrl";
import { clearOppositeAuthSession } from "@/lib/auth/clearOppositeAuthSession";
import { hasGptStoreAuthUserByEmail } from "@/lib/auth/gptAuthByEmail";
import { buildGptLoginErrorMessage, suggestGptRegisteredEmail } from "@/lib/auth/gptLoginHints";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { hasSubsStoreAuthUserByEmail } from "@/lib/auth/subsMembershipByEmail";
import { clearSiteUiLogout } from "@/lib/auth/siteUiSession";
import { syncProfileRoleForUser } from "@/lib/auth/syncProfileRole";
import { upsertSiteMembership } from "@/lib/auth/siteMembership";
import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { createClient, tryCreateAdminClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

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
      setTimeout(() => resolve(null), 2500);
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

  const cookieStore = await cookies();
  await clearOppositeAuthSession("gpt-store", cookieStore);

  const supabase = await createClient();

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !authData.user) {
    if (isAuthRateLimitError(error?.message)) {
      return NextResponse.json(
        { error: authRateLimitUserMessage(error?.message ?? ""), code: "rate_limited" },
        { status: 429 },
      );
    }

    const lower = (error?.message ?? "").toLowerCase();
    const invalidCreds =
      lower.includes("invalid login") || lower.includes("invalid credentials");

    const [inGpt, inSubs] = await Promise.all([
      hasGptStoreAuthUserByEmail(email),
      hasSubsStoreAuthUserByEmail(email),
    ]);

    if (!inGpt && inSubs) {
      return NextResponse.json(
        {
          error:
            "Этот email зарегистрирован в Spotify Store, а не в GPT STORE. Откройте вход: /login?site=subs-store.",
          code: "wrong_project",
        },
        { status: 401 },
      );
    }

    if (invalidCreds || !authData.user) {
      const suggestedEmail = await suggestGptRegisteredEmail(email);
      return NextResponse.json(
        {
          error: buildGptLoginErrorMessage({
            email,
            inGpt,
            suggestedEmail,
          }),
          code: inGpt ? "invalid_credentials" : "email_not_found",
          suggestedEmail: suggestedEmail ?? undefined,
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? `Не удалось войти: ${error?.message ?? "unknown"}`
            : "Не удалось войти. Попробуйте снова.",
        code: "auth_error",
      },
      { status: 401 },
    );
  }

  const fastRole = fastStaffRoleFromEmail(authData.user.email);
  const peeked = fastRole ? null : await peekGptProfileRole(authData.user.id);
  const role: UserRole = fastRole ?? peeked ?? "client";

  void syncProfileRoleForUser(authData.user.id, authData.user.email ?? null)
    .then((synced) => {
      const membershipRole: "customer" | "operator" | "admin" =
        synced === "admin" || synced === "operator" ? synced : "customer";
      return upsertSiteMembership(authData.user.id, "gpt-store", membershipRole);
    })
    .catch(() => undefined);

  const path = resolvePostLoginPath(effectiveReturnUrl, role);
  const res = NextResponse.json({ ok: true, path, role });

  clearSiteUiLogout(res, "gpt-store");
  res.cookies.set("current_site", "gpt-store", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });

  return res;
}
