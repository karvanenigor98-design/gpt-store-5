import type { SiteSlug } from "@/lib/sites";

const GPT_PAID_LIKE = new Set([
  "paid",
  "activating",
  "active",
  "waiting_client",
]);

const SUBS_PAID_LIKE = new Set([
  "paid",
  "processing",
  "activating",
  "activated",
  "completed",
  "awaiting_operator",
  "awaiting_data",
]);

export function isPaidLikeStatus(status: string, siteSlug: SiteSlug): boolean {
  const s = status.trim().toLowerCase();
  return siteSlug === "subs-store" ? SUBS_PAID_LIKE.has(s) : GPT_PAID_LIKE.has(s);
}

export function isTransitionToPaidLike(
  prevStatus: string,
  nextStatus: string,
  siteSlug: SiteSlug,
): boolean {
  return isPaidLikeStatus(nextStatus, siteSlug) && !isPaidLikeStatus(prevStatus, siteSlug);
}
