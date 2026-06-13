import { buildYandexMetrikaInlineScript } from "@/lib/analytics/yandex-metrika-snippet";

/** Счётчик Я.Метрики только для витрины GPT STORE (не Subs / админка / кабинет). */
export const GPT_STORE_YM_COUNTER_ID = 109608543;

export function getGptStoreYmId(): number | null {
  const raw = process.env.NEXT_PUBLIC_GPT_STORE_YM_ID;
  const id = Number(raw);
  if (Number.isFinite(id) && id > 0) return id;
  return GPT_STORE_YM_COUNTER_ID;
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

export function parseSiteQueryFromSearch(search: string | null): string | null {
  if (!search) return null;
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const site = new URLSearchParams(raw).get("site");
  return site === "subs-store" || site === "gpt-store" ? site : null;
}

/** @deprecated используйте buildYandexMetrikaInlineScript */
export const buildGptStoreMetrikaInlineScript = buildYandexMetrikaInlineScript;
