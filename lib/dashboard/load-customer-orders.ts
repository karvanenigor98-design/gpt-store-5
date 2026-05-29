import type { SupabaseClient } from "@supabase/supabase-js";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { filterOrdersBySite, isSpotifyProduct } from "@/lib/sites";
import {
  normalizeGptOrderRow,
  normalizeSubsOrderRow,
  type CustomerOrderView,
} from "@/lib/dashboard/customer-order-view";

function dedupeOrders(orders: CustomerOrderView[]): CustomerOrderView[] {
  const seen = new Set<string>();
  const out: CustomerOrderView[] = [];
  for (const o of orders) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
}

function isGptOrderProduct(product: string): boolean {
  return !isSpotifyProduct(product);
}

export async function loadCustomerOrdersForUser(params: {
  siteSlug: SiteSlug;
  userId: string;
  userEmail: string | null;
}): Promise<CustomerOrderView[]> {
  const { siteSlug, userId, userEmail } = params;

  if (siteSlug === "subs-store") {
    const { browserLike: supabase } = await createSiteSessionClient(siteSlug);
    return loadSubsCustomerOrders(supabase, userId, userEmail);
  }

  return loadGptCustomerOrders(userId, userEmail);
}

export async function loadCustomerOrdersWithFocus(params: {
  siteSlug: SiteSlug;
  userId: string;
  userEmail: string | null;
  orderFocusId?: string | null;
}): Promise<{
  orders: CustomerOrderView[];
  focusedOrder?: CustomerOrderView;
  orderFocusMissing: boolean;
}> {
  let orders = await loadCustomerOrdersForUser({
    siteSlug: params.siteSlug,
    userId: params.userId,
    userEmail: params.userEmail,
  });

  const focusId = params.orderFocusId?.trim();
  if (!focusId) {
    return { orders, orderFocusMissing: false };
  }

  let focusedOrder = orders.find((o) => o.id === focusId);
  if (!focusedOrder) {
    const fetched = await fetchCustomerOrderById({
      siteSlug: params.siteSlug,
      userId: params.userId,
      userEmail: params.userEmail,
      orderId: focusId,
    });
    if (fetched) {
      orders = dedupeOrders([fetched, ...orders]);
      focusedOrder = fetched;
    }
  }

  return {
    orders,
    focusedOrder,
    orderFocusMissing: !focusedOrder,
  };
}

async function loadGptCustomerOrders(
  userId: string,
  userEmail: string | null,
): Promise<CustomerOrderView[]> {
  const admin = createAdminClient();
  const siteId = await getSiteUUID("gpt-store");

  let query = admin
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (siteId) {
    query = query.or(`site_id.eq.${siteId},site_id.is.null`) as typeof query;
  }

  const { data: byUser } = await query;
  const rows = filterOrdersBySite((byUser ?? []) as { product: string }[], "gpt-store");

  const normalized = rows.map((r) => normalizeGptOrderRow(r as Record<string, unknown>));
  return dedupeOrders(normalized);
}

async function loadSubsCustomerOrders(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | null,
): Promise<CustomerOrderView[]> {
  const subsAdmin = createSubsStoreAdminClient();
  if (!subsAdmin) return [];

  const { data: byUser } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  let rawRows: Record<string, unknown>[] = (byUser ?? []) as Record<string, unknown>[];

  const email = userEmail?.trim().toLowerCase();
  if (email) {
    const { data: byEmail } = await subsAdmin
      .from("orders")
      .select("*")
      .eq("customer_email", email)
      .order("created_at", { ascending: false })
      .limit(50);

    const emailRows = (byEmail ?? []) as Record<string, unknown>[];
    const byId = new Map<string, Record<string, unknown>>();
    for (const row of [...rawRows, ...emailRows]) {
      byId.set(String(row.id), row);
    }
    rawRows = [...byId.values()];

    const orphanIds = emailRows.filter((o) => !o.user_id).map((o) => String(o.id));
    if (orphanIds.length) {
      await subsAdmin
        .from("orders")
        .update({ user_id: userId })
        .in("id", orphanIds)
        .eq("customer_email", email);
    }
  }

  if (!rawRows.length) return [];

  const tariffIds = [
    ...new Set(rawRows.map((r) => r.tariff_id).filter((id): id is string => Boolean(id))),
  ];
  const titleById = new Map<string, string>();
  const slugById = new Map<string, string>();
  if (tariffIds.length) {
    const { data: tariffs } = await subsAdmin.from("tariffs").select("id,title,slug").in("id", tariffIds);
    for (const t of tariffs ?? []) {
      if (t.id) {
        if (t.title) titleById.set(t.id, t.title);
        if (t.slug) slugById.set(t.id, t.slug);
      }
    }
  }

  return dedupeOrders(
    rawRows.map((row) => {
      const tid = row.tariff_id ? String(row.tariff_id) : null;
      return normalizeSubsOrderRow(
        row,
        tid ? titleById.get(tid) : null,
        tid ? slugById.get(tid) : null,
      );
    }),
  );
}

async function fetchCustomerOrderById(params: {
  siteSlug: SiteSlug;
  userId: string;
  userEmail: string | null;
  orderId: string;
}): Promise<CustomerOrderView | null> {
  const { siteSlug, userId, userEmail, orderId } = params;

  if (siteSlug === "subs-store") {
    const subsAdmin = createSubsStoreAdminClient();
    if (!subsAdmin) return null;

    const { data: row } = await subsAdmin.from("orders").select("*").eq("id", orderId).maybeSingle();
    if (!row) return null;

    const email = userEmail?.trim().toLowerCase() ?? "";
    const orderEmail = (row.customer_email ?? "").trim().toLowerCase();
    const owned = row.user_id === userId || (!!email && !!orderEmail && orderEmail === email);

    if (!owned) return null;

    if (!row.user_id) {
      await subsAdmin.from("orders").update({ user_id: userId }).eq("id", orderId);
    }

    let tariffTitle: string | null = null;
    let tariffSlug: string | null = null;
    if (row.tariff_id) {
      const { data: tariff } = await subsAdmin
        .from("tariffs")
        .select("title,slug")
        .eq("id", row.tariff_id)
        .maybeSingle();
      tariffTitle = tariff?.title ?? null;
      tariffSlug = tariff?.slug ?? null;
    }

    return normalizeSubsOrderRow(row as Record<string, unknown>, tariffTitle, tariffSlug);
  }

  const admin = createAdminClient();
  const { data: row } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!row) return null;

  const product = String(row.product ?? "");
  if (!isGptOrderProduct(product)) return null;

  const owned = row.user_id === userId;
  if (!owned) return null;

  return normalizeGptOrderRow(row as Record<string, unknown>);
}
