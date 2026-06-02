import { getSiteUUID } from "@/lib/admin/getSiteId";
import {
  applyGptStoreSiteFilter,
  GPT_PUBLISHED_STATUSES,
} from "@/lib/reviews/gpt-store-review-query";
import type { PublicReview } from "@/lib/reviews/publicReviews";
import { resolveReviewAuthorDisplay } from "@/lib/reviews/review-author-display";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

const FALLBACK_COLORS = ["#10a37f", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];
const MIN_PUBLIC_REVIEW_RATING = 1;
/** Короткие, но прошедшие модерацию отзывы тоже показываем. */
const MIN_PUBLIC_REVIEW_TEXT_LENGTH = 3;

function isMissingColumnError(message: string | null | undefined): boolean {
  const m = String(message ?? "").toLowerCase();
  return m.includes("column") || m.includes("does not exist") || m.includes("schema cache");
}

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

function mapGptRow(
  item: {
    id: string;
    author_name: string | null;
    author_username: string | null;
    content: string;
    rating: number | null;
    telegram_date: string | null;
    published_at: string | null;
    created_at: string | null;
    original_url: string | null;
  },
  idx: number,
): PublicReview | null {
  const text = (item.content ?? "").trim();
  if (text.length < MIN_PUBLIC_REVIEW_TEXT_LENGTH) return null;
  const rating =
    item.rating != null && Number.isFinite(item.rating)
      ? Math.min(5, Math.max(1, Math.round(Number(item.rating))))
      : 5;
  if (rating < MIN_PUBLIC_REVIEW_RATING) return null;

  const { displayName: authorName, username: resolvedUsername } = resolveReviewAuthorDisplay({
    authorName: item.author_name?.trim() || "Клиент",
    authorUsername: item.author_username,
    content: text,
  });
  const authorKey = normalizeAuthorKey(resolvedUsername || authorName);
  const usernameClean = resolvedUsername ? resolvedUsername.replace(/^@+/, "") : null;
  const sortTs = item.published_at ?? item.telegram_date ?? item.created_at;

  return {
    id: item.id,
    authorName,
    authorUsername: resolvedUsername,
    content: text,
    rating,
    dateLabel: formatDateLabel(sortTs),
    sortTs,
    sourceUrl: item.original_url || (usernameClean ? `https://t.me/${usernameClean}` : null),
    inSiteProfileUrl: `/reviews?author=${encodeURIComponent(authorKey)}`,
    avatarColor: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
    initials: initialsFromName(authorName),
  };
}

/** Опубликованные отзывы GPT STORE из Supabase (модерация, site-aware). */
export async function loadGptPublishedDbReviews(
  siteSlug: "gpt-store" | "subs-store" = "gpt-store",
  limit = 200,
): Promise<PublicReview[]> {
  const admin = createAdminClient();
  const siteId = await getSiteUUID(siteSlug);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin.from("reviews") as any)
    .select(
      "id, author_name, author_username, content, rating, telegram_date, published_at, created_at, original_url",
    )
    .in("status", GPT_PUBLISHED_STATUSES)
    .not("content", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query = applyGptStoreSiteFilter(query as any, siteSlug, siteId) as typeof query;

  let { data, error } = (await query) as {
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  };

  if (error && isMissingColumnError(error.message)) {
    // Legacy-safe fallback: published_at/site_id may be absent in older schemas.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fallbackQuery = (admin.from("reviews") as any)
      .select("id, author_name, author_username, content, rating, telegram_date, created_at, original_url, status")
      .in("status", GPT_PUBLISHED_STATUSES)
      .not("content", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    fallbackQuery = applyGptStoreSiteFilter(fallbackQuery, siteSlug, siteId);

    const fallback = (await fallbackQuery) as {
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    };
    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data?.length) return [];

  const out: PublicReview[] = [];
  for (let i = 0; i < data.length; i += 1) {
    const mapped = mapGptRow(
      data[i] as {
        id: string;
        author_name: string | null;
        author_username: string | null;
        content: string;
        rating: number | null;
        telegram_date: string | null;
        published_at: string | null;
        created_at: string | null;
        original_url: string | null;
      },
      i,
    );
    if (mapped) out.push(mapped);
  }
  return out;
}

/** Опубликованные отзывы Subs Store (отдельная БД). */
export async function loadSubsPublishedDbReviews(limit = 200): Promise<PublicReview[]> {
  const subs = createSubsStoreAdminClient();
  if (!subs) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data, error } = (await (subs.from("reviews") as any)
    .select("id,name,text,rating,created_at,published_at,status,is_published")
    .eq("is_published", true)
    .not("rating", "is", null)
    .not("text", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit)) as { data: Record<string, unknown>[] | null; error: { message: string } | null };

  if (!error && data?.length) {
    data = data.filter((row) => {
      const status = (row as { status?: string }).status;
      return !status || status === "approved" || status === "published";
    });
  }

  if (error?.message?.toLowerCase().includes("column")) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallback = (await (subs.from("reviews") as any)
      .select("id,name,text,rating,created_at,is_published")
      .eq("is_published", true)
      .not("rating", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit)) as { data: Record<string, unknown>[] | null; error: { message: string } | null };
    data = (fallback.data ?? []).map((r) => ({ ...r, status: "approved" }));
    error = fallback.error;
  }

  if (error || !data?.length) return [];

  const out: PublicReview[] = [];
  for (let i = 0; i < data.length; i += 1) {
    const row = data[i] as {
      id: string;
      name?: string | null;
      text?: string | null;
      rating?: number | null;
      created_at?: string | null;
      published_at?: string | null;
    };
    const text = String(row.text ?? "").trim();
    if (text.length < MIN_PUBLIC_REVIEW_TEXT_LENGTH) continue;
    const rating = Math.min(5, Math.max(1, Math.round(Number(row.rating))));
    if (rating < MIN_PUBLIC_REVIEW_RATING) continue;
    const authorName = (row.name && String(row.name).trim()) || "Клиент";
    const authorKey = normalizeAuthorKey(authorName);
    const sortTs = row.published_at ?? row.created_at ?? null;

    out.push({
      id: String(row.id),
      authorName,
      authorUsername: null,
      content: text,
      rating,
      dateLabel: formatDateLabel(sortTs),
      sortTs,
      sourceUrl: null,
      inSiteProfileUrl: `/spotify/reviews?author=${encodeURIComponent(authorKey)}`,
      avatarColor: FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      initials: initialsFromName(authorName),
    });
  }
  return out;
}
