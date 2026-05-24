import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderStatus } from "@/types/database";

import {
  filterGptOrderRowsByStatus,
  loadGptStoreOrderRows,
} from "@/lib/admin/gpt-orders-query";

export type GptAdminOrderRow = {
  id: string;
  product: string;
  plan_id: string;
  price: number;
  status: OrderStatus;
  account_email: string | null;
  created_at: string;
  user_id: string | null;
};

export async function fetchGptOrdersForAdmin(
  admin: SupabaseClient,
  opts: { filterStatus?: string; offset: number; limit: number },
): Promise<{ orders: GptAdminOrderRow[]; error: string | null }> {
  const { rows, error } = await loadGptStoreOrderRows(admin, { maxRows: 500 });

  if (error) {
    return { orders: [], error: error };
  }

  const filtered = filterGptOrderRowsByStatus(rows, opts.filterStatus);
  const page = filtered.slice(opts.offset, opts.offset + opts.limit);

  return { orders: page as GptAdminOrderRow[], error: null };
}
