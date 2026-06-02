import { createAdminClient } from "@/lib/supabase/server";
import { getSiteUUID } from "@/lib/admin/getSiteId";
import {
  applyGptStoreSiteFilter,
  gptPublishedStatusFilter,
} from "@/lib/reviews/gpt-store-review-query";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

function isColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("column") || m.includes("does not exist") || m.includes("schema cache");
}

export type AdminReviewRow = {
  id: string;
  author_name: string | null;
  author_username: string | null;
  content: string;
  telegram_date: string | null;
  rating: number | null;
};

export async function loadGptAdminReviews(
  siteSlug: "gpt-store" | "subs-store",
  status: "pending" | "approved" | "rejected",
): Promise<AdminReviewRow[]> {
  const admin = createAdminClient();
  const siteId = await getSiteUUID(siteSlug);

  const statusFilter = gptPublishedStatusFilter(status);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin.from("reviews") as any)
    .select("id,author_name,author_username,content,telegram_date,created_at,published_at,status,rating")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (Array.isArray(statusFilter)) {
    query = query.in("status", statusFilter);
  } else {
    query = query.eq("status", statusFilter);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query = applyGptStoreSiteFilter(query as any, siteSlug, siteId) as typeof query;

  let { data, error } = (await query) as {
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  };

  if (error && isColumnError(error.message)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fallbackQuery = (admin.from("reviews") as any)
      .select("id,author_name,author_username,content,telegram_date,created_at,status,rating")
      .order("created_at", { ascending: false })
      .limit(500);
    if (Array.isArray(statusFilter)) {
      fallbackQuery = fallbackQuery.in("status", statusFilter);
    } else {
      fallbackQuery = fallbackQuery.eq("status", statusFilter);
    }
    fallbackQuery = applyGptStoreSiteFilter(fallbackQuery, siteSlug, siteId);
    const fallback = (await fallbackQuery) as {
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
    };
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    console.error("[loadGptAdminReviews]", error.message);
    return [];
  }

  return (data ?? []).map((review) => ({
    id: review.id as string,
    author_name: (review.author_name as string | null) ?? null,
    author_username: (review.author_username as string | null) ?? null,
    content: (review.content as string) ?? "",
    telegram_date:
      (review.published_at as string | null) ??
      (review.telegram_date as string | null) ??
      (review.created_at as string | null) ??
      null,
    rating:
      review.rating != null && Number.isFinite(Number(review.rating))
        ? Math.min(5, Math.max(1, Math.round(Number(review.rating))))
        : null,
  }));
}

export async function loadSubsAdminReviews(
  status: "pending" | "approved" | "rejected",
): Promise<AdminReviewRow[]> {
  const subs = createSubsStoreAdminClient();
  if (!subs) return [];

  let { data, error } = await subs
    .from("reviews")
    .select("id,name,text,rating,status,is_published,created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error && isColumnError(error.message)) {
    if (status === "pending") {
      const fallback = await subs
        .from("reviews")
        .select("id,name,text,rating,is_published,created_at")
        .eq("is_published", false)
        .order("created_at", { ascending: false })
        .limit(50);
      data = (fallback.data ?? []).map((r) => ({ ...r, status: "pending" as const }));
      error = fallback.error;
    } else if (status === "approved") {
      const fallback = await subs
        .from("reviews")
        .select("id,name,text,rating,is_published,created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(50);
      data = (fallback.data ?? []).map((r) => ({ ...r, status: "approved" as const }));
      error = fallback.error;
    } else {
      const legacy = await subs
        .from("reviews")
        .select("id,author_name,content,status,created_at,telegram_date")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(50);
      data = (legacy.data ?? []).map((r) => ({
        id: r.id,
        name: r.author_name,
        text: r.content,
        rating: null,
        status: r.status,
        is_published: r.status === "approved",
        created_at: r.created_at,
      }));
      error = legacy.error;
    }
  }

  if (error) {
    console.error("[loadSubsAdminReviews]", error.message);
    return [];
  }

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const name =
      (typeof row.name === "string" && row.name) ||
      (typeof row.author_name === "string" && row.author_name) ||
      "Аноним";
    const text =
      (typeof row.text === "string" && row.text) ||
      (typeof row.content === "string" && row.content) ||
      "";
    return {
      id: String(row.id),
      author_name: name,
      author_username: null,
      content: text,
      telegram_date: (row.created_at as string) ?? null,
      rating:
        row.rating != null && Number.isFinite(Number(row.rating))
          ? Math.min(5, Math.max(1, Math.round(Number(row.rating))))
          : null,
    };
  });
}
