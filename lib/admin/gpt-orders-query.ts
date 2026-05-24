import type { SupabaseClient } from "@supabase/supabase-js";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { filterOrdersBySite, isSpotifyProduct } from "@/lib/sites";

const ORDERS_SELECT =
  "id, product, plan_id, price, status, account_email, created_at, user_id";

const ORDERS_SELECT_WITH_SITE = `${ORDERS_SELECT}, site_id`;

export type GptOrderRowRaw = {
  id: string;
  product: string;
  plan_id: string;
  price: number;
  status: string;
  account_email: string | null;
  created_at: string;
  user_id: string | null;
  site_id?: string | null;
};

function isGptOrderRow(
  row: GptOrderRowRaw,
  gptSiteId: string | null,
  subsSiteId: string | null,
): boolean {
  if (subsSiteId && row.site_id === subsSiteId) return false;
  if (isSpotifyProduct(row.product)) return false;
  if (gptSiteId && row.site_id === gptSiteId) return true;
  if (row.site_id && gptSiteId && row.site_id !== gptSiteId) return false;
  return true;
}

async function fetchOrderRows(
  admin: SupabaseClient,
  select: string,
  maxRows: number,
): Promise<{ rows: GptOrderRowRaw[]; error: string | null; missingSiteColumn: boolean }> {
  const { data, error } = await admin
    .from("orders")
    .select(select)
    .order("created_at", { ascending: false })
    .limit(maxRows);

  if (error) {
    const missingSiteColumn = /site_id|column/i.test(error.message);
    return { rows: [], error: error.message, missingSiteColumn };
  }

  return { rows: (data ?? []) as unknown as GptOrderRowRaw[], error: null, missingSiteColumn: false };
}

/** Загружает GPT-заказы: все из БД + фильтр product/site_id (без раннего return по site_id). */
export async function loadGptStoreOrderRows(
  admin: SupabaseClient,
  opts?: { maxRows?: number },
): Promise<{ rows: GptOrderRowRaw[]; error: string | null }> {
  const maxRows = opts?.maxRows ?? 500;
  const [gptSiteId, subsSiteId] = await Promise.all([
    getSiteUUID("gpt-store"),
    getSiteUUID("subs-store"),
  ]);

  let result = await fetchOrderRows(admin, ORDERS_SELECT_WITH_SITE, maxRows);

  if (result.error && result.missingSiteColumn) {
    result = await fetchOrderRows(admin, ORDERS_SELECT, maxRows);
  }

  if (result.error) {
    return { rows: [], error: result.error };
  }

  let rows = result.rows;

  if (result.missingSiteColumn === false && gptSiteId) {
    rows = rows.filter((row) => isGptOrderRow(row, gptSiteId, subsSiteId));
  } else {
    rows = filterOrdersBySite(rows, "gpt-store");
    if (subsSiteId) {
      rows = rows.filter((o) => o.site_id !== subsSiteId);
    }
  }

  return { rows, error: null };
}

export function filterGptOrderRowsByStatus(
  rows: GptOrderRowRaw[],
  filterStatus?: string,
): GptOrderRowRaw[] {
  if (filterStatus === "awaiting_payment") {
    return rows.filter((o) => o.status === "pending");
  }
  if (filterStatus) {
    return rows.filter((o) => o.status === filterStatus);
  }
  return rows;
}
