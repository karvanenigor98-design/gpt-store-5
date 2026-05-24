import { REVIEWS } from "@/lib/chatgpt-data";
import { createAdminClient } from "@/lib/supabase/server";
import {
  isServiceAuthorName,
  resolveReviewAuthorDisplay,
} from "@/lib/reviews/review-author-display";

export type PublicReview = {
  id: string;
  authorName: string;
  authorUsername: string | null;
  content: string;
  rating: number | null;
  dateLabel: string;
  sourceUrl: string | null;
  inSiteProfileUrl: string;
  avatarColor: string;
  initials: string;
};

const FALLBACK_COLORS = ["#10a37f", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];
const CHATGPT_REVIEW_PATTERN = /(chat\s*gpt|чат\s*gpt|gpt[-\s]?4|gpt[-\s]?4o|gpt\b)/i;
const SPOTIFY_REVIEW_PATTERN =
  /(spotify|спотифай|spotify\s*premium|premium\s*spotify|премиум\s*spotify|subs\s*store|подписк[аи]\s*spotify|spotify\s*plus)/i;
const SERVICE_CONTENT_PATTERN = /(номер заказа|заказ[:#]|клиент[:#]|отзыв[:#])/i;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function normalizeAuthorKey(value: string): string {
  return value.trim().toLowerCase();
}

function formatDateLabel(value: string | null): string {
  if (!value) return "Недавно";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Недавно";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function sanitizeBotMentions(text: string): string {
  return text
    .replace(/\bчерез\s+бота\b/gi, "через поддержку")
    .replace(/\bв\s+боте\b/gi, "в чате")
    .replace(/\bбот\b/gi, "поддержка")
    .replace(/\bbot\b/gi, "support");
}

function cleanReviewText(value: string): string {
  return sanitizeBotMentions(
    value
    .replace(/номер\s+заказа[:#]?\s*\d+\s*/gi, "")
    .replace(/клиент[:#]?\s*@[\w_]+\s*/gi, "")
    .replace(/отзыв[:#]?\s*/gi, "")
    .replace(/🆔/g, "")
    .replace(/[⭐★☆]/g, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, "")
    .replace(/^[\s\-:|]+/g, "")
    .replace(/^[^\p{L}\p{N}@]+/u, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.:;!?])/g, "$1")
    .trim(),
  );
}

function extractRating(value: string): number | null {
  const matches = value.match(/[⭐★]/g);
  if (!matches?.length) return null;
  return Math.min(5, matches.length);
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type GetPublicReviewsOptions = {
  chatgptOnly?: boolean;
  spotifyOnly?: boolean;
  randomize?: boolean;
  uniqueAuthors?: boolean;
};

function fallbackReviews(): PublicReview[] {
  return REVIEWS.map((review, idx) => {
    const authorKey = normalizeAuthorKey(review.name);
    return {
      id: `fallback-${idx}`,
      authorName: review.name,
      authorUsername: null,
      content: review.text,
        rating: null,
      dateLabel: review.date,
      sourceUrl: null,
      inSiteProfileUrl: `/reviews?author=${encodeURIComponent(authorKey)}`,
      avatarColor: review.avatarColor,
      initials: review.initials,
    };
  });
}

export async function getPublicReviews(limit?: number, options?: GetPublicReviewsOptions): Promise<PublicReview[]> {
  try {
    const supabase = createAdminClient();
    const query = supabase
      .from("reviews")
      .select("id, author_name, author_username, content, telegram_date, original_url")
      .eq("status", "approved")
      .order("telegram_date", { ascending: false });

    const fetchLimit = options?.randomize ? 500 : (limit ?? 200);
    const { data, error } = await query.limit(fetchLimit);
    if (error || !data || data.length === 0) return fallbackReviews().slice(0, limit ?? 200);

    let mapped = data.map((item, idx) => {
      const { displayName: authorName, username: resolvedUsername } = resolveReviewAuthorDisplay({
        authorName: item.author_name?.trim() || "Клиент",
        authorUsername: item.author_username,
        content: item.content || "",
      });
      const username = resolvedUsername;

      const cleanedContent = cleanReviewText(item.content);
      const rating = extractRating(item.content);
      const authorKey = normalizeAuthorKey(username || authorName);
      const usernameClean = username ? username.replace(/^@+/, "") : null;
      const sourceUrl = item.original_url || (usernameClean ? `https://t.me/${usernameClean}` : null);

      return {
        id: item.id,
        authorName,
        authorUsername: username,
        content: cleanedContent,
        rating,
        dateLabel: formatDateLabel(item.telegram_date),
        sourceUrl,
        inSiteProfileUrl: `/reviews?author=${encodeURIComponent(authorKey)}`,
        avatarColor: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
        initials: initialsFromName(authorName),
      };
    });

    mapped = mapped.filter((item) => {
      const serviceAuthor = isServiceAuthorName(item.authorName);
      const serviceContent = SERVICE_CONTENT_PATTERN.test(item.content);
      const tooShort = item.content.length < 6;
      return !serviceAuthor && !serviceContent && !tooShort;
    });

    if (options?.chatgptOnly) {
      mapped = mapped.filter((item) => CHATGPT_REVIEW_PATTERN.test(item.content));
    }

    if (options?.spotifyOnly) {
      mapped = mapped.filter(
        (item) =>
          SPOTIFY_REVIEW_PATTERN.test(item.content) && !CHATGPT_REVIEW_PATTERN.test(item.content),
      );
    }

    if (options?.uniqueAuthors) {
      const seen = new Set<string>();
      mapped = mapped.filter((item) => {
        const key = normalizeAuthorKey(item.authorUsername || item.authorName);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (options?.randomize) {
      mapped = shuffle(mapped);
    }

    if (!mapped.length) return fallbackReviews().slice(0, limit ?? 200);
    return mapped.slice(0, limit ?? 200);
  } catch {
    return fallbackReviews().slice(0, limit ?? 200);
  }
}
