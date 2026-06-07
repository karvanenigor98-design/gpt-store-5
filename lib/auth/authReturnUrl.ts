import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { isCheckoutReturnPath, readCheckoutIntent } from "@/lib/checkout/checkout-intent";

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
    if (raw === "/cabinet" || raw === "/dashboard") return fallback;
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

/**
 * Финальный returnUrl после login/register/callback.
 * Сохраняет checkout-маршруты и подтягивает sessionStorage intent, если query потерян.
 */
export function resolveAuthReturnUrl(
  raw: string | null | undefined,
  site: AuthSiteSlug,
  options?: { useCheckoutIntent?: boolean },
): string {
  const fallback = defaultCustomerDashboard(site);
  const fromQuery =
    raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "";

  if (isCheckoutReturnPath(fromQuery)) {
    return fromQuery;
  }

  const normalized = normalizeAuthReturnUrl(fromQuery || null, site);

  if (options?.useCheckoutIntent !== false && normalized === fallback) {
    const intent = readCheckoutIntent(site);
    if (intent?.returnPath && isCheckoutReturnPath(intent.returnPath)) {
      return intent.returnPath;
    }
  }

  return normalized;
}
