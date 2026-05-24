import curatedRaw from "@/data/spotify-telegram-reviews.json";
import type { SpotifyLandingReview } from "@/lib/landing/spotify-landing-types";

import { resolveReviewAuthorDisplay } from "./review-author-display";
import { isSpotifySuitableReview } from "./is-spotify-suitable-review";

const REVIEW_AVATAR_COLORS = ["#1DB954", "#2d6a4f", "#1a7a4a", "#0d7377", "#155724", "#ef4444", "#f59e0b"];

type CuratedRow = {
  id: string;
  authorName: string;
  authorUsername?: string | null;
  content: string;
  rating?: number;
  tariff?: string;
  dateLabel?: string;
  sourceUrl?: string;
};

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

function profileUrl(authorKey: string): string {
  return `/spotify/reviews?author=${encodeURIComponent(authorKey)}`;
}

function cleanReviewText(value: string): string {
  return value
    .replace(/номер\s+заказа[:#]?\s*\d+\s*/gi, "")
    .replace(/клиент[:#]?\s*@[\w_]+\s*/gi, "")
    .replace(/отзыв[:#]?\s*/gi, "")
    .replace(/🆔/g, "")
    .replace(/[⭐★☆]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function mapRow(row: CuratedRow): SpotifyLandingReview | null {
  const content = cleanReviewText(row.content);
  const { displayName: authorName, username } = resolveReviewAuthorDisplay({
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    content: row.content,
  });

  if (!isSpotifySuitableReview(content)) return null;

  const authorKey = normalizeAuthorKey(username || authorName);
  const h = hashString(row.id);

  return {
    id: row.id,
    authorName,
    authorUsername: username,
    initials: initialsFromName(authorName),
    avatarColor: REVIEW_AVATAR_COLORS[h % REVIEW_AVATAR_COLORS.length],
    tariff: row.tariff ?? "Premium",
    dateLabel: row.dateLabel ?? "Недавно",
    rating: row.rating != null ? Math.min(5, Math.max(1, Math.round(row.rating))) : 5,
    content,
    sourceUrl: row.sourceUrl ?? null,
    inSiteProfileUrl: profileUrl(authorKey),
  };
}

/** Отфильтрованные отзывы из Telegram-экспорта (без GPT/ботов). */
export function loadSpotifyTelegramCuratedReviews(): SpotifyLandingReview[] {
  const rows = curatedRaw as CuratedRow[];
  const out: SpotifyLandingReview[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const mapped = mapRow(row);
    if (!mapped) continue;
    const key = `${normalizeAuthorKey(mapped.authorUsername || mapped.authorName)}::${mapped.content.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapped);
  }

  return out;
}
