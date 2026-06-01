import { getSiteUUID } from "@/lib/admin/getSiteId";
import type { PublicReview } from "@/lib/reviews/publicReviews";
import { resolveReviewAuthorDisplay } from "@/lib/reviews/review-author-display";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

const FALLBACK_COLORS = ["#10a37f", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

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
  if (text.length < 6) return null;
  const rating =
    item.rating != null && Number.isFinite(item.rating)
      ? Math.min(5, Math.max(1, Math.round(Number(item.rating))))
      : null;
  if (!rating) return null;

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
    .eq("status", "approved")
    .not("rating", "is", null)
    .not("content", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (siteId) {
    query = query.eq("site_id", siteId);
  }

  const { data, error } = (await query) as {
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  };
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
    .eq("status", "approved")
    .eq("is_published", true)
    .not("rating", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit)) as { data: Record<string, unknown>[] | null; error: { message: string } | null };

  if (error?.message?.toLowerCase().includes("column")) {
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
    if (text.length < 6) continue;
    const rating = Math.min(5, Math.max(1, Math.round(Number(row.rating))));
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
