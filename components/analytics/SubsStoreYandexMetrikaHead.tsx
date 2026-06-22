import { headers } from "next/headers";
import { buildYandexMetrikaInlineScript } from "@/lib/analytics/yandex-metrika-snippet";
import {
  getSubsStoreYmId,
  isSubsStoreMetrikaPath,
  parseSiteQueryFromSearch,
} from "@/lib/analytics/subs-store-metrika";

function resolveRequestHost(headerBag: Headers): string {
  const raw = headerBag.get("x-forwarded-host") ?? headerBag.get("host") ?? "";
  return raw.split(",")[0]?.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function SubsStoreYandexMetrikaHead() {
  const ymId = getSubsStoreYmId();
  if (!ymId) return null;

  const h = headers();
  const pathname = h.get("x-invoke-pathname") ?? "/";
  const siteQuery = parseSiteQueryFromSearch(h.get("x-invoke-search"));
  const hostname = resolveRequestHost(h);
  if (!isSubsStoreMetrikaPath(pathname, siteQuery, hostname)) return null;

  return (
    <>
      <script
        type="text/javascript"
        data-subs-store-metrika="1"
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
