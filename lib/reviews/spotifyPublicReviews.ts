import { SPOTIFY_REVIEWS } from "@/lib/content/spotify";
import type { SpotifyLandingReview } from "@/lib/landing/spotify-landing-types";

import { isSpotifySuitableReview } from "./is-spotify-suitable-review";
import { loadSpotifyTelegramCuratedReviews } from "./load-spotify-telegram-curated";
import { loadSubsPublishedDbReviews } from "./load-published-db-reviews";
import { sortLandingReviewsTopRatedThenNew } from "./merge-public-reviews";
import { reviewSortTimestamp } from "./review-sanitize";

function normalizeAuthorKey(value: string): string {
  return value.trim().toLowerCase();
}

function profileUrl(authorKey: string): string {
  return `/spotify/reviews?author=${encodeURIComponent(authorKey)}`;
}

function fallbackReviews(): SpotifyLandingReview[] {
  return SPOTIFY_REVIEWS.map((r) => {
    const authorKey = normalizeAuthorKey(r.authorName);
    return {
      ...r,
      authorUsername: null,
      sourceUrl: null,
      inSiteProfileUrl: profileUrl(authorKey),
    };
  });
}

function sortSpotifyReviewsNewestFirst(items: SpotifyLandingReview[]): SpotifyLandingReview[] {
  return [...items].sort((a, b) => {
    const tb = reviewSortTimestamp(b.dateLabel, b.sortTs);
    const ta = reviewSortTimestamp(a.dateLabel, a.sortTs);
    return tb - ta;
  });
}

function dedupeReviews(items: SpotifyLandingReview[]): SpotifyLandingReview[] {
  const seen = new Set<string>();
  const out: SpotifyLandingReview[] = [];

  for (const item of items) {
    const key = `${normalizeAuthorKey(item.authorUsername || item.authorName)}::${item.content.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

async function loadSubsReviews(limit: number): Promise<SpotifyLandingReview[]> {
  const rows = await loadSubsPublishedDbReviews(limit);
  return rows.map((r) => mapPublicReviewToSpotify(r));
}

function mapPublicReviewToSpotify(item: {
  id: string;
  authorName: string;
  authorUsername: string | null;
  initials: string;
  avatarColor: string;
  dateLabel: string;
  rating: number | null;
  content: string;
  sourceUrl: string | null;
  inSiteProfileUrl: string;
  sortTs?: string | number | null;
}): SpotifyLandingReview {
  const authorKey = normalizeAuthorKey(item.authorUsername || item.authorName);
  return {
    id: item.id,
    authorName: item.authorName,
    authorUsername: item.authorUsername,
    initials: item.initials,
    avatarColor: item.avatarColor,
    tariff: "Premium",
    dateLabel: item.dateLabel,
    rating: item.rating ?? 5,
    content: item.content,
    sourceUrl: item.sourceUrl,
    inSiteProfileUrl: profileUrl(authorKey),
    sortTs: item.sortTs ?? null,
  };
}

function filterSuitable(items: SpotifyLandingReview[]): SpotifyLandingReview[] {
  return items.filter((item) => isSpotifySuitableReview(item.content));
}

/**
 * Публичные отзывы Spotify: Telegram-экспорт (отфильтровано) + Subs Supabase + одобренные из GPT DB.
 */
export async function getSpotifyPublicReviews(limit = 200): Promise<SpotifyLandingReview[]> {
  const curated = loadSpotifyTelegramCuratedReviews();

  const subsReviews = await loadSubsReviews(limit);

  const fromDb = filterSuitable(subsReviews);

  const merged = sortLandingReviewsTopRatedThenNew(
    dedupeReviews([...curated, ...fromDb]),
    10,
  );

  if (!merged.length) {
    return sortSpotifyReviewsNewestFirst(filterSuitable(fallbackReviews())).slice(0, limit);
  }
  return merged.slice(0, limit);
}
