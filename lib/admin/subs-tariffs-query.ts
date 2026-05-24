import type { SupabaseClient } from "@supabase/supabase-js";

const TARIFFS_BASE_SELECT =
  "id,slug,title,price,old_price,category,badge,description,is_active,sort_order,updated_at,allow_promocodes,allow_discounts";

const TARIFFS_EXTENDED_SELECT = `${TARIFFS_BASE_SELECT},short_description,duration_months,monthly_price,savings_text,is_popular,is_best_value,cta_text`;

function isMissingColumnError(message: string): boolean {
  return /does not exist|column .* does not/i.test(message);
}

/** Тарифы Subs: расширенный select, при отсутствии колонок — базовый (без миграции 004). */
export async function fetchSubsTariffsForAdmin(subs: SupabaseClient) {
  const extended = await subs
    .from("tariffs")
    .select(TARIFFS_EXTENDED_SELECT)
    .order("sort_order", { ascending: true });

  if (!extended.error) {
    return { items: extended.data ?? [], error: null as string | null };
  }

  if (!isMissingColumnError(extended.error.message)) {
    return { items: [] as Record<string, unknown>[], error: extended.error.message };
  }

  const base = await subs
    .from("tariffs")
    .select(TARIFFS_BASE_SELECT)
    .order("sort_order", { ascending: true });

  if (base.error) {
    return { items: [] as Record<string, unknown>[], error: base.error.message };
  }

  const items = (base.data ?? []).map((row) => ({
    ...row,
    short_description: null,
    duration_months: null,
    monthly_price: null,
    savings_text: null,
    is_popular: false,
    is_best_value: false,
    cta_text: null,
  }));

  return { items, error: null as string | null };
}
