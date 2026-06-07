import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminClientOrderAgg } from "@/lib/admin/admin-clients-orders";
import {
  inferGptPlanDurationMonths,
  resolveGptAdminActivePlanTitle,
} from "@/lib/admin/admin-subscription-label";
import { loadGptStoreOrderRows } from "@/lib/admin/gpt-orders-query";

type OrderExt = {
  id: string;
  activated_at?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
  plan_name?: string | null;
};

async function loadOrderExtensions(
  admin: SupabaseClient,
  ids: string[],
): Promise<Map<string, OrderExt>> {
  const byId = new Map<string, OrderExt>();
  if (!ids.length) return byId;

  const extended = await admin
    .from("orders")
    .select("id, activated_at, expires_at, paid_at, plan_name")
    .in("id", ids);

  if (!extended.error) {
    for (const row of extended.data ?? []) {
      if (row.id) byId.set(String(row.id), row as OrderExt);
    }
    return byId;
  }

  if (!/does not exist|column .* does not/i.test(extended.error.message)) {
    return byId;
  }

  const paidOnly = await admin.from("orders").select("id, paid_at").in("id", ids);
  for (const row of paidOnly.data ?? []) {
    if (row.id) byId.set(String(row.id), { id: String(row.id), paid_at: row.paid_at });
  }
  return byId;
}

/** GPT-заказы для /admin/clients: фильтр site/product + устойчивый select дат подписки. */
export async function loadGptOrdersForAdminClients(
  admin: SupabaseClient,
): Promise<{ orders: AdminClientOrderAgg[]; error: string | null }> {
  const { rows, error } = await loadGptStoreOrderRows(admin, { maxRows: 5000 });
  if (error) return { orders: [], error };

  const extById = await loadOrderExtensions(
    admin,
    rows.map((r) => r.id).filter(Boolean),
  );

  const orders: AdminClientOrderAgg[] = rows.map((row) => {
    const ext: OrderExt = extById.get(row.id) ?? { id: row.id };
    const planTitle = resolveGptAdminActivePlanTitle({
      plan_id: row.plan_id,
      product: row.product,
      plan_name: ext.plan_name ?? null,
    });

    return {
      id: row.id,
      user_id: row.user_id,
      status: row.status,
      plan_id: row.plan_id,
      product: row.product,
      plan_name: ext.plan_name ?? null,
      account_email: row.account_email,
      created_at: row.created_at,
      activated_at: ext.activated_at ?? null,
      expires_at: ext.expires_at ?? null,
      paid_at: ext.paid_at ?? null,
      planTitle,
      durationMonths: inferGptPlanDurationMonths(row.plan_id, planTitle),
    };
  });

  return { orders, error: null };
}
