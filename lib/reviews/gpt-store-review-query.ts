/** Статусы, при которых отзыв считается опубликованным (админка + сайт). */
export const GPT_PUBLISHED_STATUSES = ["approved", "published"] as const;

export type GptReviewModerationStatus = "pending" | "approved" | "rejected";

/** Единый фильтр по магазину GPT STORE — админка и публичный сайт используют одну логику. */
export function applyGptStoreSiteFilter<T extends { or: (filter: string) => T; eq: (col: string, val: string) => T }>(
  query: T,
  siteSlug: "gpt-store" | "subs-store",
  siteId: string | null,
): T {
  if (!siteId) return query;
  if (siteSlug === "gpt-store") {
    return query.or(`site_id.eq.${siteId},site_id.is.null`);
  }
  return query.eq("site_id", siteId);
}

export function gptPublishedStatusFilter(status: GptReviewModerationStatus): string | string[] {
  if (status === "approved") return [...GPT_PUBLISHED_STATUSES];
  return status;
}
