import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { filterOrdersBySite } from "@/lib/sites";
import {
  normalizeGptOrderRow,
  normalizeSubsOrderRow,
  type CustomerOrderView,
} from "@/lib/dashboard/customer-order-view";

export async function loadCustomerOrdersForUser(params: {
  siteSlug: SiteSlug;
  userId: string;
  userEmail: string | null;
}): Promise<CustomerOrderView[]> {
  const { siteSlug, userId, userEmail } = params;
  const { browserLike: supabase } = await createSiteSessionClient(siteSlug);

  if (siteSlug === "subs-store") {
    return loadSubsCustomerOrders(supabase, userId, userEmail);
  }

  return loadGptCustomerOrders(supabase, userId, userEmail);
}

async function loadGptCustomerOrders(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | null,
): Promise<CustomerOrderView[]> {
  const { data: byUser } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  let rows = filterOrdersBySite((byUser ?? []) as { product: string }[], "gpt-store");
  if (rows.length) {
    return rows.map((r) => normalizeGptOrderRow(r as Record<string, unknown>));
  }

  const email = userEmail?.trim().toLowerCase();
  if (!email) return [];

  const admin = createAdminClient();
  const { data: byEmail } = await admin
    .from("orders")
    .select("*")
    .ilike("account_email", email)
    .order("created_at", { ascending: false })
    .limit(50);

  const filtered = (byEmail ?? []) as Record<string, unknown>[];
  const gptOnly = filterOrdersBySite(
    filtered.map((r) => ({ product: String(r.product ?? "") })),
    "gpt-store",
  );
  if (!gptOnly.length) return [];

  const orphanIds = filtered
    .filter((o) => !o.user_id && filterOrdersBySite([{ product: String(o.product ?? "") }], "gpt-store").length)
    .map((o) => String(o.id));
  if (orphanIds.length) {
    await admin.from("orders").update({ user_id: userId }).in("id", orphanIds);
  }

  return filtered
    .filter((r) => filterOrdersBySite([{ product: String(r.product ?? "") }], "gpt-store").length)
    .map((r) => normalizeGptOrderRow(r));
}

async function loadSubsCustomerOrders(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | null,
): Promise<CustomerOrderView[]> {
  const subsAdmin = createSubsStoreAdminClient();

  const { data: byUser } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  let rawRows: Record<string, unknown>[] = (byUser ?? []) as Record<string, unknown>[];

  if (!rawRows.length && userEmail && subsAdmin) {
    const email = userEmail.trim().toLowerCase();
    const { data: byEmail } = await subsAdmin
      .from("orders")
      .select("*")
      .eq("customer_email", email)
      .order("created_at", { ascending: false })
      .limit(50);
    rawRows = (byEmail ?? []) as Record<string, unknown>[];
    const orphanIds = rawRows.filter((o) => !o.user_id).map((o) => String(o.id));
    if (orphanIds.length) {
      await subsAdmin.from("orders").update({ user_id: userId }).in("id", orphanIds).eq("customer_email", email);
    }
  }

  if (!rawRows.length) return [];

  const tariffIds = [
    ...new Set(rawRows.map((r) => r.tariff_id).filter((id): id is string => Boolean(id))),
  ];
  const titleById = new Map<string, string>();
  const slugById = new Map<string, string>();
  if (subsAdmin && tariffIds.length) {
    const { data: tariffs } = await subsAdmin.from("tariffs").select("id,title,slug").in("id", tariffIds);
    for (const t of tariffs ?? []) {
      if (t.id) {
        if (t.title) titleById.set(t.id, t.title);
        if (t.slug) slugById.set(t.id, t.slug);
      }
    }
  }

  return rawRows.map((row) => {
    const tid = row.tariff_id ? String(row.tariff_id) : null;
    return normalizeSubsOrderRow(
      row,
      tid ? titleById.get(tid) : null,
      tid ? slugById.get(tid) : null,
    );
  });
}
