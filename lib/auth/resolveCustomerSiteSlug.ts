import { headers } from "next/headers";

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
 * Источники: query/cookie site, путь, dev-порт (3055 = Subs, 3056 = GPT).
 */
export async function resolveCustomerSiteSlug(params: {
  siteParam?: string | null;
  pathname?: string;
}): Promise<SiteSlug> {
  const h = await headers();
  const port = devPortFromHeaders(h);
  const pathname = params.pathname ?? h.get("x-invoke-pathname") ?? "";

  if (port === "3055") return "subs-store";
  if (port === "3056") return "gpt-store";

  if (pathname.startsWith("/spotify") || pathname.startsWith("/checkout/spotify")) {
    return "subs-store";
  }

  const cookieSite = params.siteParam?.trim();
  if (cookieSite === "subs-store" || cookieSite === "gpt-store") {
    return cookieSite;
  }

  return detectAuthSiteFromStrings("", "", cookieSite);
}
