import { headers } from "next/headers";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { isSpotifyStoreHostname } from "@/lib/site-url";

function hostFromHeaders(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-host")?.split(",")[0]?.trim();
  return (forwarded || headerList.get("host") || "").split(":")[0];
}

/** site из ?site=, иначе spotify-store.ru → subs-store. */
export async function resolveCheckoutSiteSlug(siteParam?: string): Promise<SiteSlug> {
  if (siteParam === "subs-store") return "subs-store";
  if (siteParam === "gpt-store") return "gpt-store";

  const headerList = await headers();
  if (isSpotifyStoreHostname(hostFromHeaders(headerList))) {
    return "subs-store";
  }

  return "gpt-store";
}
