import { headers } from "next/headers";
import {
  buildGptStoreMetrikaInlineScript,
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
        dangerouslySetInnerHTML={{
          __html: buildGptStoreMetrikaInlineScript(ymId),
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
