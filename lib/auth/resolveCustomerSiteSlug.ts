import { cookies, headers } from "next/headers";

import { detectAuthSiteFromStrings } from "@/lib/auth/detectAuthSite";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

function devPortFromHeaders(h: Headers): string | null {
  const host = h.get("host") ?? "";
  const portFromHost = host.includes(":") ? host.split(":")[1]?.trim() : "";
  if (portFromHost) return portFromHost;
  const fwd = h.get("x-forwarded-port")?.trim();
  return fwd || null;
}

/**
 * Какой магазин обслуживает личный кабинет (GPT vs Subs).
 * Источники: query site, путь, dev-порт (3055 = Subs, 3056 = GPT), cookie current_site.
 */
export async function resolveCustomerSiteSlug(params: {
  siteParam?: string | null;
  pathname?: string;
}): Promise<SiteSlug> {
  const h = await headers();
  const port = devPortFromHeaders(h);
  const pathname = params.pathname ?? h.get("x-invoke-pathname") ?? "";
  const cookieStore = await cookies();
  const cookieSite = cookieStore.get("current_site")?.value;

  const siteParam = params.siteParam?.trim();
  if (siteParam === "subs-store" || siteParam === "gpt-store") {
    return siteParam;
  }

  const headerSite = h.get("x-site-slug")?.trim();
  if (headerSite === "subs-store" || headerSite === "gpt-store") {
    return headerSite;
  }

  if (port === "3055") return "subs-store";
  if (port === "3056") return "gpt-store";

  if (pathname.startsWith("/spotify") || pathname.startsWith("/checkout/spotify")) {
    return "subs-store";
  }

  return detectAuthSiteFromStrings("", "", cookieSite, pathname);
}
