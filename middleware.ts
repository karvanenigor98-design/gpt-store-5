import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import {
  buildSpotifyLinkPreviewHtml,
  isLinkPreviewBot,
} from "@/lib/brand/spotify-link-preview-html";
import { requestHasSupabaseAuthCookie } from "@/lib/auth/has-supabase-auth-cookie";
import { resolveStaffAwayFromClientCabinet } from "@/lib/auth/staff-cabinet-access";
import { resolveStaffAuthRedirect } from "@/lib/auth/staff-auth-redirect";
import { resolveServerRole } from "@/lib/auth/server-role";
import {
  isSiteUiLoggedOut,
  resolveSiteFromRequest,
  type SiteSlug,
} from "@/lib/auth/siteUiSession";
import {
  getSubsPublicSupabaseAnonKey,
  getSubsPublicSupabaseUrl,
  isSubsPublicAuthConfigured,
} from "@/lib/supabase/subs-auth-env";
import { getAuthCookieOptions } from "@/lib/supabase/auth-cookie-options";
import { getGptPublicSupabaseUrl } from "@/lib/supabase/validate-project-url";
import {
  isGptDevPort,
  isSubsDevPort,
  resolveAuthSiteContext,
} from "@/lib/auth/devStoreProfile";
import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { isSpotifyStoreHostname } from "@/lib/site-url";

function normalizeHost(raw: string | null | undefined): string {
  const value = (raw ?? "").split(",")[0]?.trim() ?? "";
  if (!value) return "";
  return value.toLowerCase().split(":")[0];
}

function resolveRequestHost(request: NextRequest): string {
  return (
    normalizeHost(request.headers.get("x-forwarded-host")) ||
    normalizeHost(request.headers.get("host")) ||
    request.nextUrl.hostname.toLowerCase()
  );
}

function resolveBrandIconBase(request: NextRequest): string {
  const port = request.nextUrl.port || null;
  if (isSubsDevPort(port)) return "/icons/spotify";
  if (isSpotifyStoreHostname(resolveRequestHost(request))) return "/icons/spotify";
  return "/icons/gpt";
}

function maybeRewriteBrandIcon(request: NextRequest): NextResponse | null {
  const path = request.nextUrl.pathname;
  if (
    path !== "/favicon.ico" &&
    path !== "/favicon.svg" &&
    path !== "/apple-touch-icon.png" &&
    path !== "/apple-touch-icon-precomposed.png"
  ) {
    return null;
  }

  const base = resolveBrandIconBase(request);
  const target =
    path === "/favicon.ico"
      ? `${base}/favicon.ico`
      : path === "/favicon.svg"
        ? `${base}/icon.svg`
        : `${base}/apple-touch-icon.png`;
  return NextResponse.rewrite(new URL(target, request.url));
}

function isGptPublicAuthConfigured(): boolean {
  return Boolean(getGptPublicSupabaseUrl() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
}

/** Public marketing/checkout pages — no Supabase round-trip on every click. */
function pathNeedsSessionLookup(path: string): boolean {
  return (
    path.startsWith("/dashboard") ||
    path.startsWith("/cabinet") ||
    path.startsWith("/admin") ||
    path.startsWith("/operator") ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/auth/") ||
    path.startsWith("/callback")
  );
}

type UserLookup = { user: User | null; timedOut: boolean };

async function getUserWithTimeout(
  sb: ReturnType<typeof createServerClient> | null,
  ms: number,
): Promise<UserLookup> {
  if (!sb) return { user: null, timedOut: false };
  try {
    return await Promise.race([
      sb.auth.getUser().then((result: { data?: { user?: User | null } }) => ({
        user: result.data?.user ?? null,
        timedOut: false,
      })),
      new Promise<UserLookup>((resolve) =>
        setTimeout(() => resolve({ user: null, timedOut: true }), ms),
      ),
    ]);
  } catch {
    return { user: null, timedOut: true };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const AUTH_LOOKUP_MS = 2000;
const MIDDLEWARE_ROLE_MS = 2500;

/** Supabase SSR: refreshed auth cookies must survive NextResponse.redirect. */
function redirectPreservingCookies(target: URL, source: NextResponse): NextResponse {
  const res = NextResponse.redirect(target);
  source.cookies.getAll().forEach(({ name, value }) => {
    res.cookies.set(name, value);
  });
  return res;
}

const CURRENT_SITE_COOKIE = {
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
  sameSite: "lax" as const,
  httpOnly: false,
};

function applyCurrentSiteCookie(
  response: NextResponse,
  path: string,
  siteQuery: string | null,
  requestHost: string,
  request: NextRequest,
  cookieSiteEarly: SiteSlug | undefined,
  devPort: string | null,
): void {
  if (isSpotifyStoreHostname(requestHost)) {
    response.cookies.set("current_site", "subs-store", CURRENT_SITE_COOKIE);
    return;
  }

  if (
    (path.startsWith("/dashboard") || path.startsWith("/cabinet")) &&
    (siteQuery === "subs-store" || siteQuery === "gpt-store")
  ) {
    response.cookies.set("current_site", siteQuery, CURRENT_SITE_COOKIE);
    return;
  }

  if (path === "/" || path === "/gpt" || path === "/gpt-store" || path === "/chatgpt") {
    response.cookies.set("current_site", "gpt-store", CURRENT_SITE_COOKIE);
    return;
  }

  if (path.startsWith("/spotify") || path.startsWith("/checkout/spotify")) {
    response.cookies.set("current_site", "subs-store", CURRENT_SITE_COOKIE);
    return;
  }

  const inferredSite: SiteSlug | null = resolveAuthSiteContext({
    siteDirect: request.nextUrl.searchParams.get("site"),
    returnUrl: request.nextUrl.searchParams.get("returnUrl"),
    cookieSite: cookieSiteEarly,
    port: devPort,
    pathname: path,
  });

  if (inferredSite) {
    response.cookies.set("current_site", inferredSite, CURRENT_SITE_COOKIE);
  }
}

async function redirectPallyCheckoutForm(request: NextRequest): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  if (request.method !== "POST") return null;
  if (path !== "/checkout/success" && path !== "/checkout/fail") return null;

  try {
    const params = new URLSearchParams(request.nextUrl.search);
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(json)) {
        if (value == null || params.has(key)) continue;
        const text = Array.isArray(value) ? String(value[0] ?? "") : String(value);
        if (text) params.set(key, text);
      }
    } else {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (typeof value !== "string" || !value || params.has(key)) continue;
        params.set(key, value);
      }
    }
    const url = request.nextUrl.clone();
    url.search = params.toString();
    return NextResponse.redirect(url, 303);
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pallyForm = await redirectPallyCheckoutForm(request);
  if (pallyForm) return pallyForm;

  const path = request.nextUrl.pathname;
  const host = resolveRequestHost(request);
  const protocol = request.nextUrl.protocol;
  const siteQuery = request.nextUrl.searchParams.get("site");

  const brandIconResponse = maybeRewriteBrandIcon(request);
  if (brandIconResponse) return brandIconResponse;

  const needsSubsSiteQuery =
    isSpotifyStoreHostname(host) &&
    process.env.NODE_ENV === "production" &&
    (path.startsWith("/admin") ||
      path.startsWith("/operator") ||
      path.startsWith("/dashboard") ||
      path.startsWith("/cabinet") ||
      path.startsWith("/login") ||
      path.startsWith("/register")) &&
    siteQuery !== "subs-store";
  if (needsSubsSiteQuery) {
    const url = request.nextUrl.clone();
    url.searchParams.set("site", "subs-store");
    return NextResponse.redirect(url, 307);
  }

  if (path === "/spotify" || path === "/spotify/") {
    const ua = request.headers.get("user-agent");
    if (isLinkPreviewBot(ua)) {
      return new NextResponse(buildSpotifyLinkPreviewHtml(request.nextUrl.origin), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      });
    }
  }

  const devPort = request.nextUrl.port || null;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-invoke-pathname", path);
  requestHeaders.set("x-invoke-search", request.nextUrl.search);
  if (isGptDevPort(devPort)) {
    requestHeaders.set("x-dev-store-profile", "gpt-store");
  } else if (isSubsDevPort(devPort)) {
    requestHeaders.set("x-dev-store-profile", "subs-store");
  }
  if (siteQuery === "subs-store" || siteQuery === "gpt-store") {
    requestHeaders.set("x-site-slug", siteQuery);
  }
  const incoming = new NextRequest(request.url, { headers: requestHeaders });

  const isGptLandingAlias = path === "/gpt" || path === "/gpt-store" || path === "/chatgpt";

  if (isGptDevPort(devPort) && (path.startsWith("/spotify") || path.startsWith("/checkout/spotify"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    process.env.NODE_ENV === "development" &&
    path === "/" &&
    isSubsDevPort(devPort) &&
    !isGptLandingAlias
  ) {
    return NextResponse.redirect(new URL("/spotify", request.url));
  }

  if (process.env.NODE_ENV === "production" && isSpotifyStoreHostname(host)) {
    if (path === "/" || isGptLandingAlias) {
      return NextResponse.redirect(new URL("/spotify", request.url));
    }
  }

  let supabaseResponse = NextResponse.next({ request: incoming });

  const cookieSiteEarlyRaw = incoming.cookies.get("current_site")?.value;
  const cookieSiteEarly =
    cookieSiteEarlyRaw === "subs-store" || cookieSiteEarlyRaw === "gpt-store" ? cookieSiteEarlyRaw : undefined;

  if (!pathNeedsSessionLookup(path)) {
    applyCurrentSiteCookie(supabaseResponse, path, siteQuery, host, request, cookieSiteEarly, devPort);
    return supabaseResponse;
  }

  const cookieApi = {
    getAll() {
      return incoming.cookies.getAll();
    },
    setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
      cookiesToSet.forEach(({ name, value }) => incoming.cookies.set(name, value));
      supabaseResponse = NextResponse.next({ request: incoming });
      cookiesToSet.forEach(({ name, value, options }) =>
        supabaseResponse.cookies.set(name, value, options),
      );
    },
  };

  const gptSb =
    isGptPublicAuthConfigured() ?
      createServerClient(
        getGptPublicSupabaseUrl(),
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookieOptions: getAuthCookieOptions(),
          cookies: cookieApi,
        },
      )
    : null;

  const subsSb =
    isSubsPublicAuthConfigured() ?
      createServerClient(getSubsPublicSupabaseUrl(), getSubsPublicSupabaseAnonKey(), {
        cookieOptions: getAuthCookieOptions(),
        cookies: cookieApi,
      })
    : null;

  const staffPath = path.startsWith("/admin") || path.startsWith("/operator");
  const staffCookiePresent =
    staffPath &&
    requestHasSupabaseAuthCookie(incoming.cookies) &&
    !isSiteUiLoggedOut("gpt-store", incoming.cookies);

  const needsSubsAuth =
    !staffPath &&
    (path.startsWith("/login") ||
      path.startsWith("/register") ||
      path.startsWith("/dashboard") ||
      path.startsWith("/cabinet") ||
      cookieSiteEarly === "subs-store");

  const [gptLookup, subsLookup] = await Promise.all([
    staffCookiePresent
      ? Promise.resolve({ user: null, timedOut: true } satisfies UserLookup)
      : getUserWithTimeout(gptSb, AUTH_LOOKUP_MS),
    needsSubsAuth
      ? getUserWithTimeout(subsSb, AUTH_LOOKUP_MS)
      : Promise.resolve({ user: null, timedOut: false } satisfies { user: null; timedOut: boolean }),
  ]);
  const gptUser = gptLookup.user;
  const subsUser = subsLookup.user;

  const protectedPaths = ["/dashboard", "/cabinet", "/admin", "/operator"];
  const isProtected = protectedPaths.some((p) => path.startsWith(p));
  const isAuthPage = path.startsWith("/login") || path.startsWith("/register");
  const canSwitchAccount = request.nextUrl.searchParams.get("switch") === "1";

  const guardedSiteSlug: SiteSlug = resolveSiteFromRequest(
    path,
    request.nextUrl.searchParams.get("site"),
    cookieSiteEarly,
  );

  const sessionUiActive = staffPath ?
    Boolean(gptUser) && !isSiteUiLoggedOut("gpt-store", incoming.cookies)
  : guardedSiteSlug === "subs-store" ?
    Boolean(isSubsPublicAuthConfigured()) &&
      Boolean(subsUser) &&
      !isSiteUiLoggedOut("subs-store", incoming.cookies)
  : Boolean(gptUser) && !isSiteUiLoggedOut("gpt-store", incoming.cookies);

  applyCurrentSiteCookie(supabaseResponse, path, siteQuery, host, request, cookieSiteEarly, devPort);

  const staffAuthLookupPending =
    staffPath &&
    gptLookup.timedOut &&
    requestHasSupabaseAuthCookie(incoming.cookies) &&
    !isSiteUiLoggedOut("gpt-store", incoming.cookies);

  if (isProtected && !sessionUiActive && !staffAuthLookupPending) {
    const url = request.nextUrl.clone();
    const fullPath = path + (request.nextUrl.search || "");
    const loginSite = resolveAuthSiteContext({
      siteDirect: request.nextUrl.searchParams.get("site"),
      returnUrl: fullPath,
      cookieSite: cookieSiteEarly,
      port: devPort,
      pathname: path,
    });
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("returnUrl", fullPath);
    url.searchParams.set("site", loginSite);
    return redirectPreservingCookies(url, supabaseResponse);
  }

  if (isAuthPage && !canSwitchAccount) {
    const siteForLogin: SiteSlug = resolveAuthSiteContext({
      siteDirect: request.nextUrl.searchParams.get("site"),
      returnUrl: request.nextUrl.searchParams.get("returnUrl"),
      cookieSite: cookieSiteEarly,
      port: devPort,
      pathname: path,
    });

    const loggedInForThisSheet =
      siteForLogin === "subs-store" ?
        Boolean(subsUser) && !isSiteUiLoggedOut("subs-store", incoming.cookies)
      : Boolean(gptUser) && !isSiteUiLoggedOut("gpt-store", incoming.cookies);

    if (loggedInForThisSheet && siteForLogin === "subs-store") {
      const returnUrl = request.nextUrl.searchParams.get("returnUrl");
      const safeReturn =
        returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//")
          ? returnUrl
          : "/dashboard?site=subs-store";
      const target = resolvePostLoginPath(safeReturn, "client");
      return redirectPreservingCookies(new URL(target, request.url), supabaseResponse);
    }

    if (loggedInForThisSheet && siteForLogin !== "subs-store" && gptUser) {
      try {
        const role = await withTimeout(resolveServerRole(gptUser), MIDDLEWARE_ROLE_MS);
        const returnUrl = request.nextUrl.searchParams.get("returnUrl");
        const target = resolveStaffAuthRedirect(role, returnUrl);
        return redirectPreservingCookies(new URL(target, request.url), supabaseResponse);
      } catch {
        return supabaseResponse;
      }
    }
  }

  if (gptUser && (path.startsWith("/dashboard") || path.startsWith("/cabinet"))) {
    try {
      const role = await withTimeout(resolveServerRole(gptUser), MIDDLEWARE_ROLE_MS);
      const staffAway = resolveStaffAwayFromClientCabinet(
        role,
        path,
        request.nextUrl.search || "",
      );
      if (staffAway) {
        return redirectPreservingCookies(new URL(staffAway, request.url), supabaseResponse);
      }
    } catch {
      /* role probe timeout — не блокируем кабинет в middleware */
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next|api/).*)"],
};
