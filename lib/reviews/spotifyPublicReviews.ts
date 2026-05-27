import { SPOTIFY_REVIEWS } from "@/lib/content/spotify";
import type { SpotifyLandingReview } from "@/lib/landing/spotify-landing-types";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

import { isSpotifySuitableReview } from "./is-spotify-suitable-review";
import { loadSpotifyTelegramCuratedReviews } from "./load-spotify-telegram-curated";
import { getPublicReviews } from "./publicReviews";
import { resolveReviewAuthorDisplay } from "./review-author-display";
import { reviewSortTimestamp } from "./review-sanitize";

const REVIEW_AVATAR_COLORS = ["#1DB954", "#2d6a4f", "#1a7a4a", "#0d7377", "#155724", "#ef4444", "#f59e0b"];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function normalizeAuthorKey(value: string): string {
  return value.trim().toLowerCase();
}

function formatRuDate(value: string | null | undefined): string {
  if (!value) return "Недавно";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Недавно";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
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

function mapSubsRow(row: {
  id: string;
  name?: string | null;
  text?: string | null;
  rating?: number | null;
  created_at?: string | null;
  author_username?: string | null;
}): SpotifyLandingReview {
  const text = String(row.text || "").trim();
  const { displayName: authorName, username } = resolveReviewAuthorDisplay({
    authorName: (row.name && String(row.name).trim()) || "Клиент",
    authorUsername: row.author_username ?? null,
    content: text,
  });
  const id = String(row.id);
  const h = hashString(id);
  const authorKey = normalizeAuthorKey(username || authorName);

  return {
    id,
    authorName,
    authorUsername: username,
    initials: initialsFromName(authorName),
    avatarColor: REVIEW_AVATAR_COLORS[h % REVIEW_AVATAR_COLORS.length],
    tariff: "Premium",
    dateLabel: formatRuDate(row.created_at),
    rating:
      row.rating != null && Number.isFinite(row.rating)
        ? Math.min(5, Math.max(1, Math.round(Number(row.rating))))
        : 5,
    content: text || "—",
    sourceUrl: null,
    inSiteProfileUrl: profileUrl(authorKey),
    sortTs: row.created_at ?? null,
  };
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
  const admin = createSubsStoreAdminClient();
  if (!admin) return [];

  try {
    let { data, error } = await admin
      .from("reviews")
      .select("id,name,text,rating,created_at,is_published,status")
      .eq("is_published", true)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error?.message?.toLowerCase().includes("column")) {
      const fallback = await admin
        .from("reviews")
        .select("id,name,text,rating,created_at,is_published")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(limit);
      data = (fallback.data ?? []).map((r) => ({ ...r, status: "approved" as const }));
      error = fallback.error;
    }

    if (error || !data?.length) return [];
    return data
      .filter((r) => (r as { id?: string }).id)
      .map((r) =>
        mapSubsRow(
          r as {
            id: string;
            name?: string | null;
            text?: string | null;
            rating?: number | null;
            created_at?: string | null;
          },
        ),
      );
  } catch {
    return [];
  }
}

function mapGptReviewToSpotify(
  item: Awaited<ReturnType<typeof getPublicReviews>>[number],
): SpotifyLandingReview {
  const authorKey = normalizeAuthorKey(item.authorUsername || item.authorName);
  return {
    id: `gpt-${item.id}`,
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

  const [subsReviews, telegramReviews] = await Promise.all([
    loadSubsReviews(limit),
    getPublicReviews(limit, { spotifyOnly: false }),
  ]);

  const fromDb = filterSuitable([
    ...subsReviews,
    ...telegramReviews.map(mapGptReviewToSpotify),
  ]);

  const merged = sortSpotifyReviewsNewestFirst(dedupeReviews([...curated, ...fromDb]));

  if (!merged.length) {
    return sortSpotifyReviewsNewestFirst(filterSuitable(fallbackReviews())).slice(0, limit);
  }
  return merged.slice(0, limit);
}
