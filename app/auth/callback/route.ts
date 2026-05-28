import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { normalizeAuthReturnUrl } from "@/lib/auth/authReturnUrl";
import { clearOppositeAuthSession } from "@/lib/auth/clearOppositeAuthSession";
import { normalizeEmailForAuth } from "@/lib/auth/normalizeEmail";
import { syncProfileRoleForUser } from "@/lib/auth/syncProfileRole";
import { syncSubsProfileRoleForUser } from "@/lib/auth/subsProfileSync";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { upsertSiteMembership } from "@/lib/auth/siteMembership";
import { clearSiteUiLogout, type SiteSlug } from "@/lib/auth/siteUiSession";
import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import {
  getSubsPublicSupabaseAnonKey,
  getSubsPublicSupabaseUrl,
  isSubsPublicAuthConfigured,
} from "@/lib/supabase/subs-auth-env";
import type { Database } from "@/types/database";

type PendingAuthCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

function applyPendingAuthCookies(res: NextResponse, pending: PendingAuthCookie[]) {
  for (const { name, value, options } of pending) {
    res.cookies.set(name, value, options ?? {});
  }
}

function siteFromQuery(requestUrl: URL): SiteSlug | null {
  const s = requestUrl.searchParams.get("site");
  return s === "subs-store" || s === "gpt-store" ? s : null;
}

/** Supabase иногда редиректит только с code=… без query — тогда смотрим returnUrl из ссылки. */
function siteFromReturnParam(requestUrl: URL): SiteSlug | null {
  const ret = requestUrl.searchParams.get("returnUrl") ?? "";
  if (ret.includes("site=gpt-store")) return "gpt-store";
  if (ret.includes("site=subs-store") || ret.includes("/spotify") || ret.startsWith("/spotify")) {
    return "subs-store";
  }
  return null;
}

function siteFromCookie(cookieVal: string | undefined): SiteSlug | null {
  return cookieVal === "subs-store" || cookieVal === "gpt-store" ? cookieVal : null;
}

function siteFromUserMetadata(meta: unknown): SiteSlug | null {
  return meta === "subs-store" || meta === "gpt-store" ? meta : null;
}

/** После сессии: приоритет явный ?site=, затем signup_site из регистрации, затем returnUrl/cookie. */
function resolveSiteWithUser(
  requestUrl: URL,
  cookieSite: string | undefined,
  userMetaSignupSite: unknown
): SiteSlug {
  return (
    siteFromQuery(requestUrl) ??
    siteFromUserMetadata(userMetaSignupSite) ??
    siteFromReturnParam(requestUrl) ??
    siteFromCookie(cookieSite) ??
    "gpt-store"
  );
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;

  const code = requestUrl.searchParams.get("code");
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const cookieSite = request.cookies.get("current_site")?.value;
  const resetSiteCookie = request.cookies.get("auth_reset_site")?.value;
  const isRecovery = type === "recovery";

  /** Recovery: never infer site from `current_site` (visit to /spotify must not hijack GPT reset). */
  let siteParam: SiteSlug = isRecovery
    ? (siteFromQuery(requestUrl) ??
      siteFromCookie(resetSiteCookie) ??
      siteFromReturnParam(requestUrl) ??
      "gpt-store")
    : (siteFromQuery(requestUrl) ??
      siteFromReturnParam(requestUrl) ??
      siteFromCookie(resetSiteCookie) ??
      siteFromCookie(cookieSite) ??
      "gpt-store");

  const defaultReturnUrl = `/cabinet?site=${siteParam}`;
  const rawReturnUrl = requestUrl.searchParams.get("returnUrl") ?? defaultReturnUrl;
  const returnUrl =
    rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//")
      ? rawReturnUrl
      : defaultReturnUrl;

  const siteQuery = `&site=${siteParam}`;

  // Supabase может вернуть ошибку прямо в URL (истёкший OTP и т.д.)
  const oauthError = requestUrl.searchParams.get("error");
  const errorCode = requestUrl.searchParams.get("error_code");
  const errorDescription = (
    requestUrl.searchParams.get("error_description") ?? ""
  ).replace(/\+/g, " ");

  if (oauthError || errorCode) {
    const blob =
      `${errorCode ?? ""} ${errorDescription} ${oauthError ?? ""}`.toLowerCase();
    const isExpired =
      blob.includes("expired") ||
      errorCode === "otp_expired" ||
      errorCode === "flow_state_expired";

    if (isRecovery) {
      return NextResponse.redirect(
        `${origin}/reset-password?error=${isExpired ? "expired" : "callback"}${siteQuery}`
      );
    }
    return NextResponse.redirect(
      `${origin}/verify-email?error=${isExpired ? "expired" : "callback"}${siteQuery}`
    );
  }

  // Нет code/token_hash в query: часто это implicit / magic link — токены в #hash (сервер их не видит).
  // Редирект на /callback теряет hash → 404. Отдаём HTML: переносим query+hash на /callback в одном шаге в браузере.
  if (!code && !token_hash) {
    let q = requestUrl.search;
    if (siteParam === "subs-store" && !q.includes("site=subs-store")) {
      q += q.includes("?") ? "&site=subs-store" : "?site=subs-store";
    }
    const isSubsUi = siteParam === "subs-store";
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${isSubsUi ? "Spotify Store" : "GPT STORE"} — подтверждение</title><style>body{margin:0;background:${isSubsUi ? "#080808" : "#f8fafc"};color:${isSubsUi ? "#9ca3af" : "#475569"};font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:2rem}.box{max-width:360px}.brand{color:${isSubsUi ? "#1DB954" : "#10a37f"};font-weight:700;font-size:1.1rem;margin-bottom:.75rem}.spin{width:28px;height:28px;border:3px solid ${isSubsUi ? "rgba(29,185,84,.25)" : "rgba(16,163,127,.25)"};border-top-color:${isSubsUi ? "#1DB954" : "#10a37f"};border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 1rem}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="box"><div class="brand">${isSubsUi ? "Spotify Store" : "GPT STORE"}</div><div class="spin"></div><p>Подтверждение ссылки из письма…</p></div><script>(function(){var q=${JSON.stringify(q)};var h=window.location.hash||"";var isRecovery=q.indexOf("type=recovery")!==-1;var isSubs=q.indexOf("site=subs-store")!==-1;if(isRecovery&&!isSubs&&q.indexOf("site=gpt-store")===-1){q+=(q.indexOf("?")===-1?"?":"&")+"site=gpt-store";}if(h&&h!=="#"&&(h.indexOf("access_token=")!==-1||h.indexOf("refresh_token=")!==-1)){window.location.replace("/callback"+q+h);return;}if(!h||h==="#"){var err=isRecovery?"/reset-password?error=callback":"/verify-email?error=callback";err+=(err.indexOf("?")===-1?"?":"&")+"site="+(isSubs?"subs-store":"gpt-store");window.location.replace(err);return;}window.location.replace("/callback"+q+h);})();</script></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const cookieStore = await cookies();
  const pendingAuthCookies: PendingAuthCookie[] = [];

  const exchangeOnSubs = siteParam === "subs-store" && isSubsPublicAuthConfigured();
  if (siteParam === "subs-store" && !isSubsPublicAuthConfigured()) {
    const q = new URLSearchParams();
    q.set("site", "subs-store");
    q.set("error", "config");
    q.set(
      "detail",
      "Нужны NEXT_PUBLIC_SUBS_SUPABASE_URL и NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY в .env.local (без них Subs Auth не завершит вход).",
    );
    return NextResponse.redirect(`${origin}/login?${q.toString()}`);
  }

  const supabaseUrl = exchangeOnSubs
    ? getSubsPublicSupabaseUrl()
    : (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnon = exchangeOnSubs
    ? getSubsPublicSupabaseAnonKey()
    : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!supabaseUrl || !supabaseAnon) {
    const q = new URLSearchParams();
    q.set("error", "config");
    q.set(
      "detail",
      exchangeOnSubs
        ? "Не заданы URL/anon для Subs Auth (NEXT_PUBLIC_SUBS_SUPABASE_URL / NEXT_PUBLIC_SUBS_SUPABASE_ANON_KEY)."
        : "Не заданы NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    if (exchangeOnSubs) q.set("site", "subs-store");
    return NextResponse.redirect(`${origin}/login?${q.toString()}`);
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookieOptions: getAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const row of cookiesToSet) {
          pendingAuthCookies.push(row);
          try {
            cookieStore.set(row.name, row.value, row.options);
          } catch {
            // Server Component / ограничения среды — дублируем только в pending для ответа
          }
        }
      },
    },
  });

  const redirectWithAuthCookies = (location: string, siteForLogin?: SiteSlug) => {
    const res = NextResponse.redirect(location);
    applyPendingAuthCookies(res, pendingAuthCookies);
    if (siteForLogin) {
      clearSiteUiLogout(res, siteForLogin);
      res.cookies.set("current_site", siteForLogin, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
        httpOnly: false,
      });
      if (location.includes("/reset-password")) {
        res.cookies.set("auth_reset_site", siteForLogin, {
          path: "/",
          maxAge: 60 * 60,
          sameSite: "lax",
          httpOnly: false,
        });
      }
    }
    return res;
  };

  let exchangeError: string | null = null;

  const pendingSignupEmail = request.cookies.get("pending_signup_email")?.value?.trim() ?? "";
  const isEmailConfirmation =
    type === "signup" ||
    type === "email" ||
    type === "invite" ||
    (!isRecovery && Boolean(code || token_hash));

  if (isEmailConfirmation) {
    await clearOppositeAuthSession(siteParam, cookieStore, (row) => {
      pendingAuthCookies.push(row);
    });
  }

  if (code) {
    // PKCE: signOut только на этом же проекте ломает code_verifier — чистим другой проект выше.
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error:", error.message);
      exchangeError = error.message;
    }
  } else if (token_hash && type) {
    // token_hash не зависит от PKCE-verifier в этом браузере — чистим чужую сессию.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "recovery" | "email" | "invite",
    });
    if (error) {
      console.error("[auth/callback] verifyOtp error:", error.message);
      exchangeError = error.message;
    }
  }

  if (exchangeError) {
    const isExpired =
      exchangeError.toLowerCase().includes("expired") ||
      exchangeError.toLowerCase().includes("flow_state") ||
      exchangeError.toLowerCase().includes("invalid flow");

    if (isRecovery) {
      return redirectWithAuthCookies(
        `${origin}/reset-password?error=${isExpired ? "expired" : "callback"}${siteQuery}`
      );
    }
    return redirectWithAuthCookies(
      `${origin}/verify-email?error=${isExpired ? "expired" : "callback"}${siteQuery}`
    );
  }

  // Успешный обмен
  if (isRecovery) {
    const recoverySite: SiteSlug = siteParam;
    const normalizedReturn =
      returnUrl.includes("site=") ? returnUrl : `/cabinet?site=${recoverySite}`;
    const recoverySiteQuery = `&site=${recoverySite}`;
    return redirectWithAuthCookies(
      `${origin}/reset-password/update?returnUrl=${encodeURIComponent(normalizedReturn)}${recoverySiteQuery}`,
      recoverySite,
    );
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      siteParam = resolveSiteWithUser(
        requestUrl,
        cookieSite,
        user.user_metadata?.signup_site
      );

      if (
        pendingSignupEmail &&
        user.email &&
        normalizeEmailForAuth(user.email) !== normalizeEmailForAuth(pendingSignupEmail)
      ) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        const q = new URLSearchParams();
        q.set("error", "wrong_account");
        if (siteParam === "subs-store") q.set("site", "subs-store");
        q.set("email", pendingSignupEmail);
        const res = redirectWithAuthCookies(`${origin}/verify-email?${q.toString()}`);
        res.cookies.set("pending_signup_email", "", { path: "/", maxAge: 0 });
        return res;
      }

      /** Сессия создана именно проектом Subs или GPT — синхронизируем только этот профиль. */
      if (exchangeOnSubs) {
        const role = await syncSubsProfileRoleForUser(user.id, user.email ?? null);
        await upsertSiteMembership(user.id, "subs-store", "customer").catch(() => undefined);

        const cabinetPath = resolvePostLoginPath(
          normalizeAuthReturnUrl(returnUrl, "subs-store"),
          role,
        );
        const res = redirectWithAuthCookies(`${origin}${cabinetPath}`, siteParam);
        res.cookies.set("pending_signup_email", "", { path: "/", maxAge: 0 });
        return res;
      }

      const role = await syncProfileRoleForUser(user.id, user.email ?? null);
      await upsertSiteMembership(user.id, siteParam, "customer");
      const path = resolvePostLoginPath(
        normalizeAuthReturnUrl(returnUrl, siteParam),
        role,
      );
      const res = redirectWithAuthCookies(`${origin}${path}`, siteParam);
      res.cookies.set("pending_signup_email", "", { path: "/", maxAge: 0 });
      return res;
    }
  } catch (err) {
    console.error("[auth/callback] post-login error:", err);
  }

  return redirectWithAuthCookies(`${origin}${returnUrl}`);
}
