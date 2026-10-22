import { REVIEW_MIN_TIMESTAMP, reviewSortTimestamp } from "@/lib/reviews/review-sanitize";

export const LANDING_AVERAGE_RATING_LABEL = "4.9";

export type LandingReviewLike = {
  id: string;
  rating: number | null;
  dateLabel: string;
  sortTs?: string | number | null;
};

function reviewTs(item: LandingReviewLike): number {
  return reviewSortTimestamp(item.dateLabel, item.sortTs);
}

function isCurrentMayReview(ts: number, now = new Date()): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === 4;
}

export function sortLandingReviewsNewestFirst<T extends LandingReviewLike>(items: T[]): T[] {
  return [...items].sort((a, b) => reviewTs(b) - reviewTs(a));
}

/** Равномерная выборка по всему диапазону дат: индекс 0 — самый новый, последний — самый старый. */
export function spreadLandingReviewsNewestToOldest<T>(items: readonly T[], maxCount: number): T[] {
  if (maxCount <= 0 || items.length === 0) return [];
  if (items.length <= maxCount) return [...items];
  if (maxCount === 1) return [items[0]!];
  const out: T[] = [];
  const used = new Set<number>();
  for (let i = 0; i < maxCount; i += 1) {
    const idx = Math.round((i * (items.length - 1)) / (maxCount - 1));
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(items[idx]!);
  }
  return out;
}

/** Отзывы с 1 мая 2025 и новее (как в Telegram-экспорте). */
export function filterReviewsFromMay<T extends LandingReviewLike>(items: T[]): T[] {
  return items.filter((item) => reviewTs(item) >= REVIEW_MIN_TIMESTAMP);
}

/** Сначала свежие за текущий май, затем остальные по дате. */
export function sortLandingReviewsMayFirst<T extends LandingReviewLike>(items: T[]): T[] {
  const sorted = sortLandingReviewsNewestFirst(items);
  const may: T[] = [];
  const rest: T[] = [];
  for (const item of sorted) {
    if (isCurrentMayReview(reviewTs(item))) may.push(item);
    else rest.push(item);
  }
  return [...may, ...rest];
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function hasExplicitRating(item: LandingReviewLike): boolean {
  return item.rating != null && item.rating >= 1 && item.rating <= 5;
}

/** ~10% отзывов с 4★, остальные 5★ → средняя 4.9 (только для legacy без rating). */
export function applyLandingRatings49<T extends LandingReviewLike>(
  items: T[],
): (T & { rating: number })[] {
  return items.map((item) => {
    if (hasExplicitRating(item)) {
      return { ...item, rating: item.rating! };
    }
    return {
      ...item,
      rating: hashId(item.id) % 10 === 0 ? 4 : 5,
    };
  });
}

export function computeLandingAverageLabel(items: { rating: number }[]): string {
  if (!items.length) return LANDING_AVERAGE_RATING_LABEL;
  const sum = items.reduce((acc, item) => acc + item.rating, 0);
  return (sum / items.length).toFixed(1);
}

/** В первой «странице» ротатора — хотя бы один отзыв не на 5★. */
export function ensureSubFiveInPreview<T extends { rating: number }>(
  items: T[],
  previewSize = 4,
): T[] {
  if (items.length <= previewSize) return items;
  if (items.slice(0, previewSize).some((r) => r.rating < 5)) return items;

  const subFiveIdx = items.findIndex((r) => r.rating < 5);
  if (subFiveIdx < 0) return items;

  const out = [...items];
  const swapWith = previewSize - 1;
  [out[swapWith], out[subFiveIdx]] = [out[subFiveIdx]!, out[swapWith]!];
  return out;
}

export type LandingMainReviewsPrepared<T extends LandingReviewLike> = {
  pool: (T & { rating: number })[];
  averageLabel: string;
  count: number;
};

/** Пул для блока отзывов на главной (оба лендинга). */
export function prepareLandingMainReviews<T extends LandingReviewLike>(
  items: T[],
): LandingMainReviewsPrepared<T> {
  const sorted = sortLandingReviewsNewestFirst(items);
  const rated = sorted.map((item) => ({
    ...item,
    rating: hasExplicitRating(item) ? item.rating! : 5,
  }));

  return {
    pool: rated,
    averageLabel: computeLandingAverageLabel(rated),
    count: rated.length,
  };
}
