import { readFileSync } from "fs";
import { join } from "path";

import curatedRaw from "@/data/gpt-telegram-reviews.json";
import type { PublicReview } from "@/lib/reviews/publicReviews";
import { resolveReviewAuthorDisplay, sanitizeReviewContent } from "@/lib/reviews/review-author-display";
import {
  reviewSortTimestamp,
  sortPublicReviewsNewestFirst,
  stripAuthorDateSuffix,
} from "@/lib/reviews/review-sanitize";
import { telegramProfileUrl } from "@/lib/reviews/telegram-profile-url";

const REVIEW_AVATAR_COLORS = ["#10a37f", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

const JSON_PATHS = [
  "data/gpt-telegram-reviews.json",
  "public/gpt-telegram-reviews.json",
];

type CuratedRow = {
  id: string;
  authorName: string;
  authorUsername?: string | null;
  content: string;
  rating?: number;
  dateLabel?: string;
  sortTs?: string | number | null;
  sourceUrl?: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizeAuthorKey(value: string): string {
  return value
    .replace(/[\uD800-\uDFFF]/g, "")
    .trim()
    .toLowerCase();
}

function safeEncodeURIComponent(value: string): string {
  try {
    return encodeURIComponent(value);
  } catch {
    return encodeURIComponent(value.replace(/[\uD800-\uDFFF]/g, ""));
  }
}

function profileUrl(authorKey: string): string {
  const key = normalizeAuthorKey(authorKey) || "client";
  return `/reviews?author=${safeEncodeURIComponent(key)}`;
}

function mapRow(row: CuratedRow): PublicReview | null {
  const { displayName: authorName, username } = resolveReviewAuthorDisplay({
    authorName: stripAuthorDateSuffix(row.authorName),
    authorUsername: row.authorUsername,
    content: row.content,
  });

  const content = sanitizeReviewContent(row.content.trim());
  if (content.length < 8) return null;

  const authorKey = normalizeAuthorKey(username || authorName);

  return {
    id: row.id,
    authorName,
    authorUsername: username,
    content,
    rating: row.rating != null ? Math.min(5, Math.max(1, Math.round(row.rating))) : 5,
    dateLabel: row.dateLabel ?? "Недавно",
    sortTs: row.sortTs ?? reviewSortTimestamp(row.dateLabel ?? ""),
    sourceUrl: telegramProfileUrl(username, row.sourceUrl),
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

function readCuratedRowsFromFs(): CuratedRow[] {
  const root = process.cwd();
  for (const rel of JSON_PATHS) {
    try {
      const text = readFileSync(join(root, rel), "utf8");
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as CuratedRow[];
      }
    } catch {
      /* try next path */
    }
  }
  return [];
}

function readCuratedRowsSync(): CuratedRow[] {
  const imported = Array.isArray(curatedRaw) ? (curatedRaw as CuratedRow[]) : [];
  if (imported.length > 0) return imported;
  return readCuratedRowsFromFs();
}

async function readCuratedRowsFromNetwork(): Promise<CuratedRow[]> {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://gpt-store-5.vercel.app";
  try {
    const res = await fetch(`${origin}/gpt-telegram-reviews.json`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const parsed = (await res.json()) as unknown;
    return Array.isArray(parsed) ? (parsed as CuratedRow[]) : [];
  } catch (err) {
    console.error("[reviews] fetch gpt-telegram-reviews.json failed:", err);
    return [];
  }
}

function buildReviews(rows: CuratedRow[], limit?: number): PublicReview[] {
  const out: PublicReview[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const mapped = mapRow(row);
    if (!mapped) continue;
    const key = `${normalizeAuthorKey(mapped.authorUsername || mapped.authorName)}::${mapped.content.slice(0, 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(mapped);
  }

  return sortPublicReviewsNewestFirst(out).slice(0, limit ?? out.length);
}

/** Отзывы GPT STORE из Telegram-экспорта (messages.html + messages2.html). */
export function loadGptTelegramCuratedReviews(limit?: number): PublicReview[] {
  return buildReviews(readCuratedRowsSync(), limit);
}

export async function loadGptTelegramCuratedReviewsAsync(limit?: number): Promise<PublicReview[]> {
  let rows = readCuratedRowsSync();
  if (rows.length === 0) {
    rows = await readCuratedRowsFromNetwork();
  }
  return buildReviews(rows, limit);
}
