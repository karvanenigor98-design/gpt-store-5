import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, NextRequest } from "next/server";
import { effectiveRoleFromProfile } from "@/lib/auth/superAdmin";
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

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const devPort = request.nextUrl.port || null;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-invoke-pathname", path);
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
    return NextResponse.redirect(url);
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
      return NextResponse.redirect(new URL("/dashboard?site=subs-store", request.url));
    }

    if (loggedInForThisSheet && siteForLogin !== "subs-store" && gptUser && gptSb) {
      const authUser = gptUser;
      const { data: prof } = await gptSb
        .from("profiles")
        .select("role")
        .eq("id", authUser.id)
        .maybeSingle();
      const role = effectiveRoleFromProfile(prof?.role ?? null, authUser.email);
      if (role === "admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      if (role === "operator") {
        return NextResponse.redirect(new URL("/operator", request.url));
      }

      const loginSite = resolveAuthSiteContext({
        siteDirect: request.nextUrl.searchParams.get("site"),
        returnUrl: request.nextUrl.searchParams.get("returnUrl"),
        cookieSite: cookieSiteEarly,
        port: devPort,
        pathname: path,
      });
      const dashboardTarget =
        loginSite === "subs-store" ? "/dashboard?site=subs-store" : "/dashboard?site=gpt-store";
      return NextResponse.redirect(new URL(dashboardTarget, request.url));
    }
  }

  if (path === "/" || path === "/gpt" || path === "/gpt-store" || path === "/chatgpt") {
    supabaseResponse.cookies.set("current_site", "gpt-store", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: false,
    });
  } else if (path.startsWith("/spotify") || path.startsWith("/checkout/spotify")) {
    supabaseResponse.cookies.set("current_site", "subs-store", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      httpOnly: false,
    });
  } else {
    const inferredSite: SiteSlug | null = resolveAuthSiteContext({
      siteDirect: request.nextUrl.searchParams.get("site"),
      returnUrl: request.nextUrl.searchParams.get("returnUrl"),
      cookieSite: cookieSiteEarly,
      port: devPort,
      pathname: path,
    });

    if (inferredSite) {
      supabaseResponse.cookies.set("current_site", inferredSite, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
        httpOnly: false,
      });
    }
  }

  if (gptUser && gptSb && (path.startsWith("/admin") || path.startsWith("/operator"))) {
    const { data: prof } = await gptSb
      .from("profiles")
      .select("role")
      .eq("id", gptUser.id)
      .maybeSingle();
    const role = effectiveRoleFromProfile(prof?.role ?? null, gptUser.email);

    if (path.startsWith("/admin") && role === "operator") {
      const suffix = path.replace(/^\/admin/, "") || "";
      return NextResponse.redirect(new URL(`/operator${suffix}${request.nextUrl.search}`, request.url));
    }
    if (path.startsWith("/operator") && role === "admin") {
      const suffix = path.replace(/^\/operator/, "") || "";
      return NextResponse.redirect(new URL(`/admin${suffix}${request.nextUrl.search}`, request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|api/).*)"],
};
