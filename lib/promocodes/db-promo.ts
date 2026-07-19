import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { PromoCode } from "@/lib/store-config";

type Admin = SupabaseClient<Database>;

type PromoRow = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  plan_ids: string[] | null;
  max_uses: number | null;
  uses_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  site_id?: string | null;
};

function mapPromoRow(row: PromoRow, now: number): PromoCode {
  const fromOk = !row.valid_from || new Date(row.valid_from).getTime() <= now;
  const untilOk = !row.valid_until || new Date(row.valid_until).getTime() >= now;
  const usesOk = row.max_uses == null || row.uses_count < row.max_uses;
  const active = row.is_active && fromOk && untilOk && usesOk;
  return {
    code: row.code.trim().toUpperCase(),
    type: row.discount_type,
    value: row.discount_value,
    active,
    planIds: row.plan_ids?.length ? row.plan_ids : undefined,
    dbId: row.id,
    maxUses: row.max_uses,
    usesCount: row.uses_count,
  };
}

/** GPT STORE promocodes only (site_id gpt-store or legacy null). */
export async function fetchPromoCodesFromDb(admin: Admin): Promise<PromoCode[]> {
  const now = Date.now();

  // Prefer site-scoped query; fall back if column missing / filter unsupported.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = await (admin.from("promocodes") as any)
    .select("*")
    .or("site_id.eq.gpt-store,site_id.is.null")
    .order("created_at", { ascending: false });

  if (!scoped.error && Array.isArray(scoped.data)) {
    return (scoped.data as PromoRow[]).map((row) => mapPromoRow(row, now));
  }

  const { data, error } = await admin
    .from("promocodes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data?.length) return [];

  return (data as PromoRow[])
    .filter((row) => {
      const site = (row.site_id ?? "").trim();
      return !site || site === "gpt-store";
    })
    .map((row) => mapPromoRow(row, now));
}

export async function incrementPromocodeUsage(admin: Admin, codeFromMeta: string | null | undefined) {
  const raw = codeFromMeta?.trim();
  if (!raw) return;
  const code = raw.toUpperCase();

  const { data: row } = await admin
    .from("promocodes")
    .select("id, uses_count, max_uses")
    .eq("code", code)
    .maybeSingle();

  if (!row) return;
  if (row.max_uses != null && row.uses_count >= row.max_uses) return;

  await admin
    .from("promocodes")
    .update({ uses_count: row.uses_count + 1, updated_at: new Date().toISOString() })
    .eq("id", row.id);
}
