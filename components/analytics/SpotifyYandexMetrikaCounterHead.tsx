import { headers } from "next/headers";

import { buildYandexMetrikaInlineScript } from "@/lib/analytics/yandex-metrika-snippet";
import {
  getSubsStoreYmId,
  isSubsStoreMetrikaPath,
  parseSiteQueryFromSearch,
} from "@/lib/analytics/subs-store-metrika";
import { isGptStoreHostname, isSpotifyStoreHostname } from "@/lib/site-url";

function resolveRequestHost(headerBag: Headers): string {
  const raw = headerBag.get("x-forwarded-host") ?? headerBag.get("host") ?? "";
  return raw.split(",")[0]?.split(":")[0]?.trim().toLowerCase() ?? "";
}

/** Официальный счётчик Я.Метрики в <head> для SPOTIFY STORE (spotify-store.ru). */
export function SpotifyYandexMetrikaCounterHead() {
  const ymId = getSubsStoreYmId();
  if (!ymId) return null;

  const h = headers();
  const host = resolveRequestHost(h);
  const pathname = h.get("x-invoke-pathname") ?? "/";
  const siteQuery = parseSiteQueryFromSearch(h.get("x-invoke-search"));

  if (host && isGptStoreHostname(host) && !isSpotifyStoreHostname(host) && !isSubsStoreMetrikaPath(pathname, siteQuery)) {
    return null;
  }
  if (host && !isSpotifyStoreHostname(host) && !isSubsStoreMetrikaPath(pathname, siteQuery)) {
    return null;
  }
  if (!isSubsStoreMetrikaPath(pathname, siteQuery)) return null;

  return (
    <>
      {/* Yandex.Metrika counter */}
      <script
        type="text/javascript"
        dangerouslySetInnerHTML={{
          __html: buildYandexMetrikaInlineScript(ymId),
        }}
      />
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${ymId}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
      {/* /Yandex.Metrika counter */}
    </>
  );
}
