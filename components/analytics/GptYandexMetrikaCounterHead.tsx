import { headers } from "next/headers";

import { buildYandexMetrikaInlineScript } from "@/lib/analytics/yandex-metrika-snippet";
import {
  getGptStoreYmId,
  isGptStoreMetrikaPath,
  parseSiteQueryFromSearch,
} from "@/lib/analytics/gpt-store-metrika";
import { isGptStoreHostname, isSpotifyStoreHostname } from "@/lib/site-url";

function resolveRequestHost(headerBag: Headers): string {
  const raw = headerBag.get("x-forwarded-host") ?? headerBag.get("host") ?? "";
  return raw.split(",")[0]?.split(":")[0]?.trim().toLowerCase() ?? "";
}

/** Официальный счётчик Я.Метрики в <head> для GPT STORE (gptplus-store.ru). */
export function GptYandexMetrikaCounterHead() {
  const ymId = getGptStoreYmId();
  if (!ymId) return null;

  const h = headers();
  const host = resolveRequestHost(h);

  if (host && isSpotifyStoreHostname(host)) return null;

  const pathname = h.get("x-invoke-pathname") ?? "/";
  const siteQuery = parseSiteQueryFromSearch(h.get("x-invoke-search"));
  if (host && !isGptStoreHostname(host) && !isGptStoreMetrikaPath(pathname, siteQuery)) {
    return null;
  }
  if (!isGptStoreMetrikaPath(pathname, siteQuery)) return null;

  return (
    <>
      {/* Yandex.Metrika counter */}
      <script
        type="text/javascript"
        data-gpt-store-metrika="1"
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
