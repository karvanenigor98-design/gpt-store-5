/** Multi-site definitions. Add new stores/landings here or via admin UI. */

export type SiteSlug = "gpt-store" | "subs-store" | (string & {});

export interface SiteDefinition {
  /** Stable identifier — used as site_id until DB sites table is fully wired */
  id: string;
  slug: SiteSlug;
  brandName: string;
  productType: "chatgpt" | "spotify" | string;
  primaryColor: string;
  accentColor: string;
  supportTelegram: string;
  supportEmail: string;
  /** Prefix used in plan_id / product fields to identify orders for this site */
  productPrefix: string;
  landingPath: string;
  checkoutPath: string;
  /** dashboard path WITH site context for buttons/links */
  dashboardPath: string;
  logoLetter: string;
  description: string;
}

export const SITES: SiteDefinition[] = [
  {
    id: "gpt-store",
    slug: "gpt-store",
    brandName: "GPT STORE",
    productType: "chatgpt",
    primaryColor: "#10a37f",
    accentColor: "#10a37f",
    supportTelegram: "@subrfmanager",
    supportEmail: "nbuzanov0@mail.ru",
    productPrefix: "chatgpt",
    landingPath: "/",
    checkoutPath: "/checkout",
    dashboardPath: "/dashboard",
    logoLetter: "G",
    description: "Магазин подписок ChatGPT Plus и Pro",
  },
  {
    id: "subs-store",
    slug: "subs-store",
    brandName: "SPOTIFY STORE",
    productType: "spotify",
    primaryColor: "#1DB954",
    accentColor: "#1DB954",
    supportTelegram: "@subs_support",
    supportEmail: "nbuzanov0@mail.ru",
    productPrefix: "spotify",
    landingPath: "/spotify",
    checkoutPath: "/checkout/spotify",
    dashboardPath: "/dashboard?site=subs-store",
    logoLetter: "S",
    description: "Магазин подписок Spotify Premium",
  },
];

export const DEFAULT_SITE = SITES[0];

/** Resolve site by slug. Falls back to GPT STORE if unknown slug. */
export function getSiteBySlug(slug: string | null | undefined): SiteDefinition {
  if (!slug) return DEFAULT_SITE;
  return SITES.find((s) => s.slug === slug) ?? DEFAULT_SITE;
}

/** Detect which site an order/product belongs to based on the product/plan_id field. */
export function getSiteForProduct(product: string): SiteDefinition {
  const lower = (product ?? "").toLowerCase();
  for (const site of SITES) {
    if (site.productPrefix && lower.startsWith(site.productPrefix)) return site;
  }
  return DEFAULT_SITE;
}

/** Публичное имя для UI (subs-store → SPOTIFY STORE). */
export function getPublicBrandName(slug: SiteSlug | string | null | undefined): string {
  return getSiteBySlug(slug).brandName;
}

/** Короткое имя для обычного текста (Title Case). */
export function getPublicBrandNameShort(slug: SiteSlug | string | null | undefined): string {
  const name = getPublicBrandName(slug);
  if (slug === "subs-store") return "SPOTIFY STORE";
  if (slug === "gpt-store") return "GPT Store";
  return name;
}

/** Quick check: does plan_id/product belong to Subs Store (Spotify)? */
export function isSpotifyProduct(product: string): boolean {
  return (product ?? "").toLowerCase().startsWith("spotify");
}

/** Filter orders for a given site slug using product field (pre-DB-migration compat). */
export function filterOrdersBySite<T extends { product: string }>(
  orders: T[],
  siteSlug: string | null | undefined
): T[] {
  if (!siteSlug || siteSlug === "gpt-store") {
    return orders.filter((o) => !isSpotifyProduct(o.product));
  }
  if (siteSlug === "subs-store") {
    return orders.filter((o) => isSpotifyProduct(o.product));
  }
  return orders;
}
