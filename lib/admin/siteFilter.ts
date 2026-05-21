/**
 * Admin site filter helpers.
 *
 * Used by all admin server pages to apply ?site= context to Supabase queries.
 * Supports both product-prefix fallback (pre-005 data) and site_id column (005+).
 */

import { isSpotifyProduct } from "@/lib/sites";

/**
 * Resolve the admin selected site slug from Next.js searchParams.
 * Falls back to gpt-store (first site = default) if not provided.
 */
export function resolveAdminSiteSlug(
  searchParams: Record<string, string | string[] | undefined> | null | undefined
): "gpt-store" | "subs-store" {
  const raw = searchParams?.site;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  return slug === "subs-store" || slug === "gpt-store" ? slug : "gpt-store";
}

/**
 * Filter an array of orders by site slug using product prefix.
 * Useful for post-query filtering when SQL filter isn't applicable.
 */
export function filterOrderArrayBySite<T extends { product: string }>(
  orders: T[],
  siteSlug: string
): T[] {
  if (siteSlug === "subs-store") {
    return orders.filter((o) => isSpotifyProduct(o.product));
  }
  return orders.filter((o) => !isSpotifyProduct(o.product));
}
