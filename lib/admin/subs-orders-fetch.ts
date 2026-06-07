import type { SupabaseClient } from "@supabase/supabase-js";

import { applySubsOrdersStatusFilter } from "@/lib/admin/subs-orders-query";
import { formatSubsTariffDisplayLabel } from "@/lib/admin/subs-tariff-display-label";

const ORDERS_SELECT =
  "id,status,payment_status,final_price,customer_email,created_at,user_id,tariff_id";

export type SubsAdminOrderRow = {
  id: string;
  status: string;
  payment_status: string;
  final_price: number;
  customer_email: string | null;
  created_at: string;
  user_id: string | null;
  tariff_id: string | null;
  tariffTitle: string;
  profileEmail: string | null;
  profileName: string | null;
};

export async function fetchSubsOrdersForAdmin(
  subs: SupabaseClient,
  opts: { filterStatus?: string; offset: number; limit: number },
): Promise<{ orders: SubsAdminOrderRow[]; error: string | null }> {
  let q = subs
    .from("orders")
    .select(ORDERS_SELECT)
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  q = applySubsOrdersStatusFilter(q, opts.filterStatus);

  const { data: rawOrders, error } = await q;

  if (error) {
    return { orders: [], error: error.message };
  }

  const rows = rawOrders ?? [];
  const tariffIds = [
    ...new Set(rows.map((r) => r.tariff_id).filter((id): id is string => Boolean(id))),
  ];
  const userIds = [
    ...new Set(rows.map((r) => r.user_id).filter((id): id is string => Boolean(id))),
  ];

  const tariffTitleById = new Map<string, string>();
  if (tariffIds.length > 0) {
    const { data: tariffs } = await subs
      .from("tariffs")
      .select("id,title,slug,category,duration_months")
      .in("id", tariffIds);
    for (const t of tariffs ?? []) {
      if (t.id) {
        tariffTitleById.set(t.id, formatSubsTariffDisplayLabel(t));
      }
    }
  }

  const profileByUserId = new Map<string, { email: string | null; full_name: string | null }>();
  if (userIds.length > 0) {
    const profilesExtended = await subs
      .from("profiles")
      .select("id,email,full_name,username")
      .in("id", userIds);
    const profilesRes =
      profilesExtended.error && /full_name/i.test(profilesExtended.error.message)
        ? await subs.from("profiles").select("id,email,username").in("id", userIds)
        : profilesExtended;
    for (const p of profilesRes.data ?? []) {
      if (!p.id) continue;
      profileByUserId.set(p.id, {
        email: (p.email as string | null) ?? null,
        full_name:
          ("full_name" in p ? (p.full_name as string | null) : null) ??
          (p.username as string | null) ??
          null,
      });
    }
  }

  const orders: SubsAdminOrderRow[] = rows.map((row) => {
    const prof = row.user_id ? profileByUserId.get(row.user_id) : undefined;
    const tariffTitle = (row.tariff_id ? tariffTitleById.get(row.tariff_id) : null) ?? "—";

    return {
      id: row.id,
      status: row.status,
      payment_status: row.payment_status,
      final_price: Number(row.final_price ?? 0),
      customer_email: row.customer_email,
      created_at: row.created_at,
      user_id: row.user_id,
      tariff_id: row.tariff_id,
      tariffTitle,
      profileEmail: prof?.email ?? null,
      profileName: prof?.full_name ?? null,
    };
  });

  return { orders, error: null };
}
