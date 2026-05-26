import { REVIEWS } from "@/lib/chatgpt-data";
import { createAdminClient } from "@/lib/supabase/server";
import { loadGptTelegramCuratedReviews } from "@/lib/reviews/load-gpt-telegram-curated";
import {
  isServiceAuthorName,
  resolveReviewAuthorDisplay,
  sanitizeReviewContent,
} from "@/lib/reviews/review-author-display";
import {
  filterReviewsByMinDate,
  sanitizeReviewAuthorName,
  sortPublicReviewsNewestFirst,
} from "@/lib/reviews/review-sanitize";

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
  /** ISO или ms — надёжная сортировка (из Telegram title). */
  sortTs?: string | number | null;
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
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function sanitizeBotMentions(text: string): string {
  return text
    .replace(/\bчерез\s+бота\b/gi, "через поддержку")
    .replace(/\bв\s+боте\b/gi, "в чате")
    .replace(/\bбот\b/gi, "поддержка")
    .replace(/\bbot\b/gi, "support");
}

function cleanReviewText(value: string): string {
  return sanitizeReviewContent(
    sanitizeBotMentions(
      value
        .replace(/номер\s+заказа[:#]?\s*\d+\s*/gi, "")
        .replace(/клиент[:#]?\s*@[\w_]+\s*/gi, "")
        .replace(/отзыв[:#]?\s*/gi, "")
        .replace(/^[\s\-:|]+/g, "")
        .replace(/^[^\p{L}\p{N}@]+/u, "")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.:;!?])/g, "$1")
        .trim(),
    ),
  );
}

function finalizeReview(item: PublicReview, idx: number): PublicReview {
  const authorName = sanitizeReviewAuthorName({
    authorName: item.authorName,
    authorUsername: item.authorUsername,
    seed: item.id,
  });
  const content = cleanReviewText(item.content);
  const authorKey = normalizeAuthorKey(item.authorUsername || authorName);
  return {
    ...item,
    authorName,
    content,
    initials: initialsFromName(authorName),
    avatarColor: item.avatarColor || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
    inSiteProfileUrl: `/reviews?author=${encodeURIComponent(authorKey)}`,
  };
}

function applyUniqueAuthors(items: PublicReview[]): PublicReview[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeAuthorKey(item.authorUsername || item.authorName);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function finalizeAndSort(items: PublicReview[], options?: GetPublicReviewsOptions): PublicReview[] {
  let out = sortPublicReviewsNewestFirst(items.map((item, idx) => finalizeReview(item, idx)));
  if (options?.minDate !== false) {
    out = filterReviewsByMinDate(out);
  }
  if (options?.uniqueAuthors) {
    out = applyUniqueAuthors(out);
  }
  return out;
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
  /** Сначала JSON из Telegram-экспорта; БД только если curated пустой. */
  preferCurated?: boolean;
  /** false — показать все даты; по умолчанию с 1 мая 2025. */
  minDate?: boolean;
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

function mergeCuratedWithLive(curated: PublicReview[], live: PublicReview[], cap?: number): PublicReview[] {
  const seen = new Set<string>();
  const out: PublicReview[] = [];
  for (const item of sortPublicReviewsNewestFirst([...curated, ...live])) {
    const key = `${item.authorUsername || item.authorName}::${item.content.slice(0, 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (cap && out.length >= cap) break;
  }
  return out;
}

export async function getPublicReviews(limit?: number, options?: GetPublicReviewsOptions): Promise<PublicReview[]> {
  const cap = limit ?? 200;
  const curatedLimit = options?.preferCurated ? 500 : options?.randomize ? 500 : cap;
  const curated = loadGptTelegramCuratedReviews(curatedLimit);

  if (options?.preferCurated !== false && curated.length > 0) {
    return finalizeAndSort(curated, options).slice(0, cap);
  }

  try {
    const supabase = createAdminClient();
    const fetchLimit = options?.randomize ? 500 : limit ?? 200;
    const { data, error } = await supabase
      .from("reviews")
      .select("id, author_name, author_username, content, telegram_date, original_url")
      .eq("status", "approved")
      .order("telegram_date", { ascending: false })
      .limit(fetchLimit);

    if (error || !data || data.length === 0) {
      if (curated.length) return finalizeAndSort(curated, options).slice(0, cap);
      return finalizeAndSort(fallbackReviews(), options).slice(0, cap);
    }

    let mapped: PublicReview[] = data.map((item, idx) => {
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
        sortTs: item.telegram_date,
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

    if (options?.randomize) {
      mapped = shuffle(mapped);
    } else {
      mapped = sortPublicReviewsNewestFirst(mapped);
    }

    if (!mapped.length) {
      if (curated.length) return finalizeAndSort(curated, options).slice(0, cap);
      return finalizeAndSort(fallbackReviews(), options).slice(0, cap);
    }

    const merged = curated.length
      ? mergeCuratedWithLive(curated, mapped, cap * 2)
      : finalizeAndSort(mapped, options);
    return finalizeAndSort(merged, options).slice(0, cap);
  } catch {
    if (curated.length) return finalizeAndSort(curated, options).slice(0, cap);
    return finalizeAndSort(fallbackReviews(), options).slice(0, cap);
  }
}
