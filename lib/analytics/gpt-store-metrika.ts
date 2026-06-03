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

export function parseSiteQueryFromSearch(search: string | null): string | null {
  if (!search) return null;
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const site = new URLSearchParams(raw).get("site");
  return site === "subs-store" || site === "gpt-store" ? site : null;
}

/** Официальный inline-код Я.Метрики (как в кабинете счётчика). */
export function buildGptStoreMetrikaInlineScript(ymId: number): string {
  return `(function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${ymId}', 'ym');

    ym(${ymId}, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});`;
}
