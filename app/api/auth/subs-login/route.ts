import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { normalizeAuthReturnUrl } from "@/lib/auth/authReturnUrl";
import { clearOppositeAuthSession } from "@/lib/auth/clearOppositeAuthSession";
import { hasGptStoreAuthUserByEmail } from "@/lib/auth/gptAuthByEmail";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { hasSubsStoreAuthUserByEmail } from "@/lib/auth/subsMembershipByEmail";
import { clearSiteUiLogout } from "@/lib/auth/siteUiSession";
import { syncSubsProfileRoleForUser } from "@/lib/auth/subsProfileSync";
import { upsertSiteMembership } from "@/lib/auth/siteMembership";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import { isSubsPublicAuthConfigured } from "@/lib/supabase/subs-auth-env";

type Body = {
  email?: string;
  password?: string;
  returnUrl?: string;
};

export async function POST(request: NextRequest) {
  if (!isSubsPublicAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Spotify Store Auth не настроен: NEXT_PUBLIC_SUBS_SUPABASE_URL и NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY в .env.local",
        code: "config",
      },
      { status: 503 },
    );
  }

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

  const rawReturn = body.returnUrl ?? "/cabinet?site=subs-store";
  const returnUrl =
    rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/cabinet?site=subs-store";
  const effectiveReturnUrl = normalizeAuthReturnUrl(returnUrl, "subs-store");

  const subs = await createSubsAuthServerClient();
  if (!subs) {
    return NextResponse.json(
      { error: "Не удалось подключиться к Subs Supabase Auth." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  await clearOppositeAuthSession("subs-store", cookieStore);
  await subs.auth.signOut({ scope: "local" }).catch(() => undefined);

  const { data: authData, error } = await subs.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !authData.user) {
    const lower = (error?.message ?? "").toLowerCase();
    const invalidCreds =
      lower.includes("invalid login") || lower.includes("invalid credentials");

    const [inSubs, inGpt] = await Promise.all([
      hasSubsStoreAuthUserByEmail(email),
      hasGptStoreAuthUserByEmail(email),
    ]);

    if (!inSubs && inGpt) {
      return NextResponse.json(
        {
          error:
            "Этот email зарегистрирован в GPT STORE, а не в Spotify Store. Войдите через /login?site=gpt-store.",
          code: "wrong_project",
        },
        { status: 401 },
      );
    }

    if (invalidCreds || !authData.user) {
      return NextResponse.json(
        {
          error: inSubs
            ? "Неправильный пароль"
            : "Аккаунт Spotify Store с таким email не найден. Зарегистрируйтесь: /register?site=subs-store",
          code: inSubs ? "invalid_credentials" : "email_not_found",
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

  let role: "admin" | "operator" | "client" = "client";
  try {
    role = await syncSubsProfileRoleForUser(authData.user.id, authData.user.email ?? null);
  } catch {
    /* profile sync optional */
  }

  await upsertSiteMembership(authData.user.id, "subs-store", "customer").catch(() => undefined);

  const path = resolvePostLoginPath(effectiveReturnUrl, role);
  const res = NextResponse.json({ ok: true, path, role });

  clearSiteUiLogout(res, "subs-store");
  res.cookies.set("current_site", "subs-store", {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });
  res.cookies.set("auth_reset_site", "", { path: "/", maxAge: 0 });

  return res;
}
