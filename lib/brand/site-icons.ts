import { getPublicSiteOrigin, getPublicSpotifySiteOrigin } from "@/lib/app-url";

export type SiteIconSlug = "gpt-store" | "subs-store";

export function iconBasePath(site: SiteIconSlug): string {
  return site === "subs-store" ? "/icons/spotify" : "/icons/gpt";
}

export function siteIconOrigin(site: SiteIconSlug): string {
  return site === "subs-store" ? getPublicSpotifySiteOrigin() : getPublicSiteOrigin();
}

export type SiteIconLink = {
  url: string;
  type?: string;
  sizes?: string;
  rel?: string;
};

export type SiteIconsBundle = {
  icon: SiteIconLink[];
  apple: SiteIconLink[];
  shortcut: string[];
};

/** Absolute favicon links for Yandex Search / Direct (see yandex.ru/support/webmaster search-results/favicon). */
export function buildSiteIconsMetadata(site: SiteIconSlug): SiteIconsBundle {
  const origin = siteIconOrigin(site);
  const base = iconBasePath(site);

  return {
    icon: [
      { url: `${origin}${base}/icon-120.png`, sizes: "120x120", type: "image/png" },
      { url: `${origin}/favicon.ico`, type: "image/x-icon" },
      { url: `${origin}${base}/icon.svg`, type: "image/svg+xml" },
      { url: `${origin}${base}/favicon-32x32.png`, sizes: "32x32", type: "image/png" },
      { url: `${origin}${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: `${origin}${base}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
    shortcut: [`${origin}/favicon.ico`],
  };
}

export function resolveSiteIconSlugFromHost(host: string, pathname = ""): SiteIconSlug {
  const h = host.toLowerCase();
  if (h.includes("spotify-store.ru")) return "subs-store";
  if (pathname.startsWith("/spotify") || pathname.startsWith("/checkout/spotify")) {
    return "subs-store";
  }
  return "gpt-store";
}
