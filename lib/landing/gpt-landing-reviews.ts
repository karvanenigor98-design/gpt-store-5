import { getStaticGptLandingReviews } from "@/lib/landing/gpt-static-landing";
import {
  spreadLandingReviewsNewestToOldest,
  sortLandingReviewsNewestFirst,
} from "@/lib/reviews/landing-reviews-display";
import { loadGptTelegramCuratedReviews } from "@/lib/reviews/load-gpt-telegram-curated";
import { loadGptPublishedDbReviews } from "@/lib/reviews/load-published-db-reviews";
import type { PublicReview } from "@/lib/reviews/publicReviews";

const DB_TIMEOUT_MS = 2500;
const LANDING_REVIEW_POOL = 72;

function uniqueAuthors(items: PublicReview[]): PublicReview[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = (item.authorUsername || item.authorName).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

/** Пул для ротатора на главной: от самых новых к самым старым, разные даты. */
export async function loadGptLandingMainReviews(): Promise<PublicReview[]> {
  const curated = loadGptTelegramCuratedReviews();
  const fromDb = await withTimeout(loadGptPublishedDbReviews("gpt-store", 1500), DB_TIMEOUT_MS, []);
  const merged = uniqueAuthors(sortLandingReviewsNewestFirst([...fromDb, ...curated]));
  const pool = merged.length
    ? merged
    : uniqueAuthors(sortLandingReviewsNewestFirst(getStaticGptLandingReviews(40)));
  return spreadLandingReviewsNewestToOldest(pool, LANDING_REVIEW_POOL);
}
