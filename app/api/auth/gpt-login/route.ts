import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

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
import { createClient } from "@/lib/supabase/server";

type Body = {
  email?: string;
  password?: string;
  returnUrl?: string;
};

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
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !authData.user) {
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
            "Этот email зарегистрирован в Subs Store (Spotify), а не в GPT STORE. Откройте вход Subs: /login?site=subs-store (порт 3055).",
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

  const role = await syncProfileRoleForUser(authData.user.id, authData.user.email ?? null);
  await upsertSiteMembership(authData.user.id, "gpt-store", "customer").catch(() => undefined);

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
