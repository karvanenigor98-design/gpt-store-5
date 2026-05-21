import type { NextRequest, NextResponse } from "next/server";

export type SiteSlug = "gpt-store" | "subs-store";

const COOKIE_GPT = "site_ui_logout_gpt";
const COOKIE_SUBS = "site_ui_logout_subs";

const COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  httpOnly: true,
};

export function siteUiLogoutCookieName(site: SiteSlug): string {
  return site === "subs-store" ? COOKIE_SUBS : COOKIE_GPT;
}

export function isSiteUiLoggedOut(
  site: SiteSlug,
  cookies: { get: (name: string) => { value?: string } | undefined }
): boolean {
  return cookies.get(siteUiLogoutCookieName(site))?.value === "1";
}

/** Определяет магазин по пути и query (для middleware / signout). */
export function resolveSiteFromRequest(
  pathname: string,
  siteParam: string | null,
  currentSiteCookie: string | undefined
): SiteSlug {
  if (siteParam === "subs-store" || siteParam === "gpt-store") {
    return siteParam;
  }
  if (pathname.startsWith("/spotify") || pathname.startsWith("/checkout/spotify")) {
    return "subs-store";
  }
  if (currentSiteCookie === "subs-store" || currentSiteCookie === "gpt-store") {
    return currentSiteCookie;
  }
  return "gpt-store";
}

export function setSiteUiLogout(response: NextResponse, site: SiteSlug): void {
  response.cookies.set(siteUiLogoutCookieName(site), "1", COOKIE_OPTS);
}

export function clearSiteUiLogout(response: NextResponse, site: SiteSlug): void {
  response.cookies.set(siteUiLogoutCookieName(site), "", { ...COOKIE_OPTS, maxAge: 0 });
}

export function clearAllSiteUiLogouts(response: NextResponse): void {
  clearSiteUiLogout(response, "gpt-store");
  clearSiteUiLogout(response, "subs-store");
}

export function applySiteUiLogoutFromRequest(request: NextRequest, response: NextResponse): SiteSlug {
  const site = resolveSiteFromRequest(
    request.nextUrl.pathname,
    request.nextUrl.searchParams.get("site"),
    request.cookies.get("current_site")?.value
  );
  setSiteUiLogout(response, site);
  return site;
}
