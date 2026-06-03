import { headers } from "next/headers";
import { buildYandexMetrikaInlineScript } from "@/lib/analytics/yandex-metrika-snippet";
import {
  getSubsStoreYmId,
  isSubsStoreMetrikaPath,
  parseSiteQueryFromSearch,
} from "@/lib/analytics/subs-store-metrika";

export function SubsStoreYandexMetrikaHead() {
  const ymId = getSubsStoreYmId();
  if (!ymId) return null;

  const h = headers();
  const pathname = h.get("x-invoke-pathname") ?? "/";
  const siteQuery = parseSiteQueryFromSearch(h.get("x-invoke-search"));
  if (!isSubsStoreMetrikaPath(pathname, siteQuery)) return null;

  return (
    <>
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
    </>
  );
}
