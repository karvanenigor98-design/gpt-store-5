import { getSiteUUID } from "@/lib/admin/getSiteId";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export type InsertReviewResult =
  | { ok: true; id: string }
  | { ok: false; error: string; code?: string };

function isMissingColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("column") || m.includes("does not exist") || m.includes("schema cache");
}

export async function insertCustomerReview(params: {
  site: "gpt-store" | "subs-store";
  authorName: string;
  authorUsername?: string | null;
  content: string;
  rating: number;
  userId?: string | null;
}): Promise<InsertReviewResult> {
  if (params.site === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) {
      return {
        ok: false,
        error: "Subs Store DB не подключена (SUBS_SUPABASE_URL / SERVICE_ROLE_KEY)",
        code: "subs_db_missing",
      };
    }

    const modernRow: Record<string, unknown> = {
      name: params.authorName,
      text: params.content,
      rating: params.rating,
      status: "pending",
      is_published: false,
    };
    if (params.userId) {
      modernRow.user_id = params.userId;
      modernRow.profile_id = params.userId;
    }

    let res = await subs.from("reviews").insert(modernRow).select("id").single();

    if (res.error && isMissingColumnError(res.error.message)) {
      const legacyRow: Record<string, unknown> = {
        author_name: params.authorName,
        content: params.content,
        status: "pending",
        telegram_date: new Date().toISOString(),
      };
      if (params.authorUsername) legacyRow.author_username = params.authorUsername;
      res = await subs.from("reviews").insert(legacyRow).select("id").single();
    }

    if (res.error || !res.data?.id) {
      return {
        ok: false,
        error: res.error?.message ?? "Не удалось сохранить отзыв в Subs Store",
        code: "subs_insert_failed",
      };
    }

    return { ok: true, id: String(res.data.id) };
  }

  const admin = createAdminClient();
  const siteId = await getSiteUUID("gpt-store");

  const { data, error } = await admin
    .from("reviews")
    .insert({
      site_id: siteId,
      author_name: params.authorName,
      author_username: params.authorUsername ?? null,
      content: params.content,
      status: "pending",
      telegram_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    return {
      ok: false,
      error: error?.message ?? "Не удалось сохранить отзыв в GPT STORE",
      code: "gpt_insert_failed",
    };
  }

  return { ok: true, id: String(data.id) };
}
