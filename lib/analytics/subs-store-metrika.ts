import { parseSiteQueryFromSearch } from "@/lib/analytics/gpt-store-metrika";
import { isSpotifyStoreHostname } from "@/lib/site-url";

export { parseSiteQueryFromSearch };

/** Счётчик Я.Метрики только для витрины SPOTIFY STORE (spotify-store.ru). */
export const SUBS_STORE_YM_COUNTER_ID = 109609539;

export function getSubsStoreYmId(): number | null {
  const raw = process.env.NEXT_PUBLIC_SUBS_STORE_YM_ID;
  const id = Number(raw);
  if (Number.isFinite(id) && id > 0) return id;
  return SUBS_STORE_YM_COUNTER_ID;
}

function isSubsCheckoutReturnPath(path: string): boolean {
  return path.startsWith("/checkout/success") || path.startsWith("/checkout/fail");
}

export function isSubsStoreMetrikaPath(
  pathname: string | null,
  siteQuery?: string | null,
  hostname?: string | null,
): boolean {
  const path = pathname ?? "/";
  if (siteQuery === "subs-store") {
    if (path.startsWith("/admin")) return false;
    if (path.startsWith("/operator")) return false;
    if (path.startsWith("/dashboard")) return false;
    return true;
  }
  if (hostname && isSpotifyStoreHostname(hostname) && isSubsCheckoutReturnPath(path)) {
    return true;
  }
  if (path === "/spotify" || path.startsWith("/spotify/")) return true;
  if (path.startsWith("/checkout/spotify")) return true;
  return false;
}
