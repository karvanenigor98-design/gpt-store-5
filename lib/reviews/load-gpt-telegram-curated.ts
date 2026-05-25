import curatedRaw from "@/data/gpt-telegram-reviews.json";
import type { PublicReview } from "@/lib/reviews/publicReviews";
import { resolveReviewAuthorDisplay } from "@/lib/reviews/review-author-display";
import { isGptSuitableReview } from "@/lib/reviews/is-gpt-suitable-review";

const REVIEW_AVATAR_COLORS = ["#10a37f", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

type CuratedRow = {
  id: string;
  authorName: string;
  authorUsername?: string | null;
  content: string;
  rating?: number;
  dateLabel?: string;
  sourceUrl?: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizeAuthorKey(value: string): string {
  return value.trim().toLowerCase();
}

function profileUrl(authorKey: string): string {
  return `/reviews?author=${encodeURIComponent(authorKey)}`;
}

function mapRow(row: CuratedRow): PublicReview | null {
  const { displayName: authorName, username } = resolveReviewAuthorDisplay({
    authorName: row.authorName,
    authorUsername: row.authorUsername,
    content: row.content,
  });

  const content = row.content.trim();
  if (!isGptSuitableReview(content)) return null;

  const authorKey = normalizeAuthorKey(username || authorName);
  const usernameClean = username ? username.replace(/^@+/, "") : null;

  return {
    id: row.id,
    authorName,
    authorUsername: username,
    content,
    rating: row.rating != null ? Math.min(5, Math.max(1, Math.round(row.rating))) : 5,
    dateLabel: row.dateLabel ?? "Недавно",
    sourceUrl: row.sourceUrl ?? (usernameClean ? `https://t.me/${usernameClean}` : null),
    inSiteProfileUrl: profileUrl(authorKey),
    avatarColor: REVIEW_AVATAR_COLORS[Math.abs(hashString(row.id)) % REVIEW_AVATAR_COLORS.length],
    initials: initialsFromName(authorName),
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Отзывы GPT STORE из Telegram-экспорта (messages.html + messages2.html). */
export function loadGptTelegramCuratedReviews(limit?: number): PublicReview[] {
  const rows = curatedRaw as CuratedRow[];
  const out: PublicReview[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const mapped = mapRow(row);
    if (!mapped) continue;
    const key = `${normalizeAuthorKey(mapped.authorUsername || mapped.authorName)}::${mapped.content.slice(0, 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapped);
    if (limit && out.length >= limit) break;
  }

  return out;
}
