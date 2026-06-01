import type { LandingReviewLike } from "@/lib/reviews/landing-reviews-display";
import type { PublicReview } from "@/lib/reviews/publicReviews";
import { reviewSortTimestamp } from "@/lib/reviews/review-sanitize";

function dedupeKey(item: PublicReview): string {
  return `${(item.authorUsername || item.authorName).toLowerCase()}::${item.content.slice(0, 100)}`;
}

/** Объединяет curated/legacy и опубликованные из БД без дублей. */
export function mergePublicReviews(
  primary: PublicReview[],
  fromDb: PublicReview[],
  cap?: number,
): PublicReview[] {
  const seen = new Set<string>();
  const out: PublicReview[] = [];

  for (const item of [...fromDb, ...primary]) {
    const key = dedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  out.sort((a, b) => reviewSortTimestamp(b.dateLabel, b.sortTs) - reviewSortTimestamp(a.dateLabel, a.sortTs));

  if (cap && out.length > cap) return out.slice(0, cap);
  return out;
}

/** Топ-N по рейтингу, затем остальные по дате (для лендинга). */
export function sortLandingReviewsTopRatedThenNew<T extends LandingReviewLike & { id: string }>(
  items: T[],
  topCount = 10,
): T[] {
  const withRating = items.filter((r) => r.rating != null && r.rating >= 1);
  const top = [...withRating]
    .sort((a, b) => {
      const dr = (b.rating ?? 0) - (a.rating ?? 0);
      if (dr !== 0) return dr;
      return reviewSortTimestamp(b.dateLabel, b.sortTs) - reviewSortTimestamp(a.dateLabel, a.sortTs);
    })
    .slice(0, topCount);

  const topIds = new Set(top.map((r) => r.id));
  const rest = items
    .filter((r) => !topIds.has(r.id))
    .sort(
      (a, b) => reviewSortTimestamp(b.dateLabel, b.sortTs) - reviewSortTimestamp(a.dateLabel, a.sortTs),
    );

  return [...top, ...rest];
}
