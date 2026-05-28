import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { defaultCustomerDashboard } from "@/lib/auth/authReturnUrl";
import { resolveAuthSiteContext } from "@/lib/auth/devStoreProfile";

const UPDATE_PATH = "/reset-password/update";

/** Site для UI / Supabase client на странице нового пароля (без эвристики returnUrl=/spotify). */
export function resolvePasswordUpdateSiteSync(params: {
  siteDirect?: string | null;
  cookieSite?: string | null;
  port?: string | null;
}): AuthSiteSlug {
  return resolveAuthSiteContext({
    siteDirect: params.siteDirect,
    returnUrl: null,
    cookieSite: params.cookieSite,
    port: params.port,
    pathname: UPDATE_PATH,
  });
}

/** Если в URL legacy `returnUrl=/spotify` без site — подставляем кабинет нужного магазина. */
export function canonicalPasswordUpdateSearchParams(
  site: AuthSiteSlug,
  returnUrl: string | null | undefined,
): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set("site", site);
  const raw = returnUrl?.trim() ?? "";
  const needsCabinet =
    !raw ||
    raw === "/spotify" ||
    raw.startsWith("/spotify/") ||
    raw === "/cabinet" ||
    raw === "/dashboard";
  qs.set(
    "returnUrl",
    needsCabinet ? defaultCustomerDashboard(site) : raw.startsWith("/") && !raw.startsWith("//") ? raw : defaultCustomerDashboard(site),
  );
  return qs;
}
