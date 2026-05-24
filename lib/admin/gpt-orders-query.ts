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
  gptSiteId: string | null,
): Promise<{ rows: GptOrderRowRaw[]; error: string | null; missingSiteColumn: boolean }> {
  let q = admin.from("orders").select(select).order("created_at", { ascending: false }).limit(maxRows);

  if (gptSiteId) {
    q = q.eq("site_id", gptSiteId);
  } else {
    q = q.not("product", "ilike", "spotify%");
  }

  let { data, error } = await q;

  if (error) {
    const missingSiteColumn = /site_id|column/i.test(error.message);
    if (missingSiteColumn && gptSiteId) {
      const fallback = await admin
        .from("orders")
        .select(select)
        .not("product", "ilike", "spotify%")
        .order("created_at", { ascending: false })
        .limit(maxRows);
      data = fallback.data;
      error = fallback.error;
    }
    if (error) {
      return { rows: [], error: error.message, missingSiteColumn };
    }
    return { rows: (data ?? []) as unknown as GptOrderRowRaw[], error: null, missingSiteColumn: true };
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

  let result = await fetchOrderRows(admin, ORDERS_SELECT_WITH_SITE, maxRows, gptSiteId);

  if (result.error && result.missingSiteColumn) {
    result = await fetchOrderRows(admin, ORDERS_SELECT, maxRows, null);
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
  const normalized = filterStatus?.trim();
  if (!normalized || normalized === "all") {
    return rows;
  }
  if (normalized === "awaiting_payment") {
    return rows.filter((o) => o.status === "pending");
  }
  return rows.filter((o) => o.status === normalized);
}
