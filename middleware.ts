import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, NextRequest } from "next/server";
import {
  buildSpotifyLinkPreviewHtml,
  isLinkPreviewBot,
} from "@/lib/brand/spotify-link-preview-html";
import { resolveStaffAuthRedirect } from "@/lib/auth/staff-access";
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

function isGptPublicAuthConfigured(): boolean {
  return Boolean(getGptPublicSupabaseUrl() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
}

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
  request: NextRequest,
  cookieSiteEarly: SiteSlug | undefined,
  devPort: string | null,
): void {
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

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

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
  const siteQuery = request.nextUrl.searchParams.get("site");
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

  let supabaseResponse = NextResponse.next({ request: incoming });

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

  let gptUser = null;
  if (gptSb) {
    try {
      const { data } = await gptSb.auth.getUser();
      gptUser = data.user;
    } catch {
      /* Supabase недоступен */
    }
  }

  let subsUser = null;
  if (subsSb) {
    try {
      const { data } = await subsSb.auth.getUser();
      subsUser = data.user;
    } catch {
      /* noop */
    }
  }

  const protectedPaths = ["/dashboard", "/cabinet", "/admin", "/operator"];
  const isProtected = protectedPaths.some((p) => path.startsWith(p));
  const isAuthPage = path.startsWith("/login") || path.startsWith("/register");
  const canSwitchAccount = request.nextUrl.searchParams.get("switch") === "1";

  const cookieSiteEarlyRaw = incoming.cookies.get("current_site")?.value;
  const cookieSiteEarly =
    cookieSiteEarlyRaw === "subs-store" || cookieSiteEarlyRaw === "gpt-store" ? cookieSiteEarlyRaw : undefined;

  const guardedSiteSlug: SiteSlug = resolveSiteFromRequest(
    path,
    request.nextUrl.searchParams.get("site"),
    cookieSiteEarly,
  );

  const staffPath = path.startsWith("/admin") || path.startsWith("/operator");

  const sessionUiActive = staffPath ?
    Boolean(gptUser) && !isSiteUiLoggedOut("gpt-store", incoming.cookies)
  : guardedSiteSlug === "subs-store" ?
    Boolean(isSubsPublicAuthConfigured()) &&
      Boolean(subsUser) &&
      !isSiteUiLoggedOut("subs-store", incoming.cookies)
  : Boolean(gptUser) && !isSiteUiLoggedOut("gpt-store", incoming.cookies);

  applyCurrentSiteCookie(supabaseResponse, path, siteQuery, request, cookieSiteEarly, devPort);

  if (isProtected && !sessionUiActive) {
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
      return redirectPreservingCookies(new URL("/dashboard?site=subs-store", request.url), supabaseResponse);
    }

    if (loggedInForThisSheet && siteForLogin !== "subs-store" && gptUser) {
      const role = await resolveServerRole(gptUser);
      const returnUrl = request.nextUrl.searchParams.get("returnUrl");
      const target = resolveStaffAuthRedirect(role, returnUrl);
      return redirectPreservingCookies(new URL(target, request.url), supabaseResponse);
    }
  }

  if (gptUser && (path.startsWith("/admin") || path.startsWith("/operator"))) {
    const role = await resolveServerRole(gptUser);

    if (path.startsWith("/admin") && role === "operator") {
      const suffix = path.replace(/^\/admin/, "") || "";
      return redirectPreservingCookies(
        new URL(`/operator${suffix}${request.nextUrl.search}`, request.url),
        supabaseResponse,
      );
    }
    if (path.startsWith("/operator") && role === "admin") {
      const suffix = path.replace(/^\/operator/, "") || "";
      return redirectPreservingCookies(
        new URL(`/admin${suffix}${request.nextUrl.search}`, request.url),
        supabaseResponse,
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/).*)"],
};
