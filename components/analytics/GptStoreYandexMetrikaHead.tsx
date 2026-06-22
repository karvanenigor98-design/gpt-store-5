import { headers } from "next/headers";
import { buildYandexMetrikaInlineScript } from "@/lib/analytics/yandex-metrika-snippet";
import {
  getGptStoreYmId,
  isGptStoreMetrikaPath,
  parseSiteQueryFromSearch,
} from "@/lib/analytics/gpt-store-metrika";

export function GptStoreYandexMetrikaHead() {
  const ymId = getGptStoreYmId();
  if (!ymId) return null;

  const h = headers();
  const pathname = h.get("x-invoke-pathname") ?? "/";
  const siteQuery = parseSiteQueryFromSearch(h.get("x-invoke-search"));
  if (!isGptStoreMetrikaPath(pathname, siteQuery)) return null;

  return (
    <>
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
    </>
  );
}
