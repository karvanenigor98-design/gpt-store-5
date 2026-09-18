import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminClientOrderAgg } from "@/lib/admin/admin-clients-orders";
import {
  inferGptPlanDurationMonths,
  resolveGptAdminActivePlanTitle,
} from "@/lib/admin/admin-subscription-label";
import { getSiteUUID } from "@/lib/admin/getSiteId";
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

function mapGptClientOrderRow(row: {
  id: string;
  user_id: string | null;
  status: string;
  plan_id: string;
  product: string | null;
  account_email: string | null;
  created_at: string;
  activated_at?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
  plan_name?: string | null;
}): AdminClientOrderAgg {
  const planTitle = resolveGptAdminActivePlanTitle({
    plan_id: row.plan_id,
    product: row.product,
    plan_name: row.plan_name ?? null,
  });
  return {
    id: row.id,
    user_id: row.user_id,
    status: row.status,
    plan_id: row.plan_id,
    product: row.product,
    plan_name: row.plan_name ?? null,
    account_email: row.account_email,
    created_at: row.created_at,
    activated_at: row.activated_at ?? null,
    expires_at: row.expires_at ?? null,
    paid_at: row.paid_at ?? null,
    planTitle,
    durationMonths: inferGptPlanDurationMonths(row.plan_id, planTitle),
  };
}

/** GPT-заказы для /admin/clients: только для user_id текущей страницы + site filter. */
export async function loadGptOrdersForUserIds(
  admin: SupabaseClient,
  userIds: string[],
): Promise<{ orders: AdminClientOrderAgg[]; error: string | null }> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return { orders: [], error: null };

  const gptSiteId = await getSiteUUID("gpt-store");
  let query = admin
    .from("orders")
    .select(
      "id, user_id, status, plan_id, product, account_email, created_at, activated_at, expires_at, paid_at, plan_name",
    )
    .in("user_id", ids)
    .not("product", "ilike", "spotify%")
    .order("created_at", { ascending: false })
    .limit(Math.min(ids.length * 40, 2000));

  if (gptSiteId) {
    query = query.or(`site_id.eq.${gptSiteId},site_id.is.null`);
  }

  const { data, error } = await query;

  if (error) {
    if (/does not exist|column .* does not/i.test(error.message)) {
      let baseQuery = admin
        .from("orders")
        .select("id, user_id, status, plan_id, product, account_email, created_at, paid_at")
        .in("user_id", ids)
        .not("product", "ilike", "spotify%")
        .order("created_at", { ascending: false })
        .limit(Math.min(ids.length * 40, 2000));
      if (gptSiteId) {
        baseQuery = baseQuery.or(`site_id.eq.${gptSiteId},site_id.is.null`);
      }
      const base = await baseQuery;
      if (base.error) return { orders: [], error: base.error.message };
      const orders: AdminClientOrderAgg[] = (base.data ?? []).map((row) =>
        mapGptClientOrderRow({
          ...row,
          activated_at: null,
          expires_at: null,
          plan_name: null,
        }),
      );
      return { orders, error: null };
    }
    return { orders: [], error: error.message };
  }

  const orders: AdminClientOrderAgg[] = (data ?? []).map((row) =>
    mapGptClientOrderRow(row as Parameters<typeof mapGptClientOrderRow>[0]),
  );

  return { orders, error: null };
}

/** @deprecated Prefer loadGptOrdersForUserIds — pulls up to 5000 rows. */
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
    return mapGptClientOrderRow({
      id: row.id,
      user_id: row.user_id,
      status: row.status,
      plan_id: row.plan_id,
      product: row.product,
      account_email: row.account_email,
      created_at: row.created_at,
      activated_at: ext.activated_at ?? null,
      expires_at: ext.expires_at ?? null,
      paid_at: ext.paid_at ?? null,
      plan_name: ext.plan_name ?? null,
    });
  });

  return { orders, error: null };
}
