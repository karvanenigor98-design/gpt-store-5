import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";

/** Личный кабинет покупателя по умолчанию. */
export function defaultCustomerDashboard(site: AuthSiteSlug): string {
  return site === "subs-store"
    ? "/dashboard/orders?site=subs-store"
    : "/dashboard/orders?site=gpt-store";
}

/** Витрина/общие пути → в кабинет после входа, регистрации или сброса пароля. */
export function normalizeAuthReturnUrl(
  raw: string | null | undefined,
  site: AuthSiteSlug,
): string {
  const fallback = defaultCustomerDashboard(site);
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;

  if (site === "subs-store") {
    if (raw === "/cabinet" || raw === "/dashboard" || raw === "/spotify") return fallback;
  } else if (
    raw === "/cabinet" ||
    raw === "/" ||
    raw === "/spotify" ||
    raw.startsWith("/spotify/")
  ) {
    return fallback;
  }

  return raw;
}
