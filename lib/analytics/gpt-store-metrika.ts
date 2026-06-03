/** Счётчик Я.Метрики только для витрины GPT STORE (не Subs / админка / кабинет). */

export function getGptStoreYmId(): number | null {
  const raw =
    process.env.NEXT_PUBLIC_GPT_STORE_YM_ID ?? process.env.NEXT_PUBLIC_YM_ID;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function isSubsStorePath(pathname: string, siteQuery?: string | null): boolean {
  if (siteQuery === "subs-store") return true;
  if (pathname === "/spotify" || pathname.startsWith("/spotify/")) return true;
  if (pathname.startsWith("/checkout/spotify")) return true;
  return false;
}

/** Публичные страницы GPT STORE, где грузим счётчик. */
export function isGptStoreMetrikaPath(
  pathname: string | null,
  siteQuery?: string | null,
): boolean {
  const path = pathname ?? "/";
  if (isSubsStorePath(path, siteQuery)) return false;
  if (path.startsWith("/admin")) return false;
  if (path.startsWith("/operator")) return false;
  if (path.startsWith("/dashboard")) return false;
  return true;
}
