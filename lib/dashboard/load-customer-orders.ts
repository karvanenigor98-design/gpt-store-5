import type { SupabaseClient } from "@supabase/supabase-js";

import { getSiteUUID } from "@/lib/admin/getSiteId";
import { tryCreateAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { filterOrdersBySite, isSpotifyProduct } from "@/lib/sites";
import {
  getCustomerOrderRecencyIso,
  isOrderAwaitingPayment,
  normalizeGptOrderRow,
  normalizeSubsOrderRow,
  type CustomerOrderView,
} from "@/lib/dashboard/customer-order-view";
import { coerceOrderStatus } from "@/lib/dashboard/order-status-tracker";

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function orderEmails(row: Record<string, unknown>): string[] {
  const emails = [normalizeEmail(row.customer_email as string), normalizeEmail(row.account_email as string)];
  return [...new Set(emails.filter(Boolean))];
}

function orderOwnedByUser(params: {
  row: Record<string, unknown>;
  userId: string;
  userEmail: string | null;
}): boolean {
  const { row, userId, userEmail } = params;
  if (row.user_id === userId) return true;
  const email = normalizeEmail(userEmail);
  if (!email) return false;
  return orderEmails(row).includes(email);
}

function sortOrdersNewestFirst(orders: CustomerOrderView[]): CustomerOrderView[] {
  return [...orders].sort(
    (a, b) =>
      new Date(getCustomerOrderRecencyIso(b)).getTime() -
      new Date(getCustomerOrderRecencyIso(a)).getTime(),
  );
}

function dedupeOrders(orders: CustomerOrderView[]): CustomerOrderView[] {
  const seen = new Set<string>();
  const out: CustomerOrderView[] = [];
  for (const o of sortOrdersNewestFirst(orders)) {
    if (seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
  }
  return out;
}

/** Один неоплаченный заказ на тариф+email — старые дубли скрываем в кабинете. */
function collapseDuplicateUnpaidOrders(orders: CustomerOrderView[]): CustomerOrderView[] {
  const seenUnpaid = new Set<string>();
  const out: CustomerOrderView[] = [];

  for (const order of sortOrdersNewestFirst(orders)) {
    if (isOrderAwaitingPayment(order.status)) {
      const email = normalizeEmail(order.account_email ?? order.customer_email);
      const key = `${order.plan_id}:${email}`;
      if (seenUnpaid.has(key)) continue;
      seenUnpaid.add(key);
    }
    out.push(order);
  }

  return out;
}

function isActivatedCustomerStatus(status: string): boolean {
  const s = coerceOrderStatus(status);
  return s === "active" || s === "activated" || s === "completed";
}

function isPaidLikeCollapsibleStatus(status: string): boolean {
  const s = coerceOrderStatus(status);
  return [
    "paid",
    "activating",
    "waiting_client",
    "active",
    "processing",
    "awaiting_operator",
    "awaiting_data",
    "activated",
    "completed",
  ].includes(s);
}

/**
 * Схлопываем только близнецов одного тарифа (двойной webhook / повтор клика),
 * не месячные продления — иначе ранг лояльности всегда «Новичок».
 */
const PAID_TWIN_MS = 72 * 60 * 60 * 1000;

function collapseDuplicatePaidLikeOrders(orders: CustomerOrderView[]): CustomerOrderView[] {
  const groups = new Map<string, CustomerOrderView[]>();
  const rest: CustomerOrderView[] = [];

  for (const order of orders) {
    if (!isPaidLikeCollapsibleStatus(order.status)) {
      rest.push(order);
      continue;
    }
    const key = order.plan_id || order.id;
    const list = groups.get(key) ?? [];
    list.push(order);
    groups.set(key, list);
  }

  const picked: CustomerOrderView[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort(
      (a, b) =>
        new Date(getCustomerOrderRecencyIso(a)).getTime() -
        new Date(getCustomerOrderRecencyIso(b)).getTime(),
    );
    const kept: CustomerOrderView[] = [];
    for (const order of sorted) {
      const prev = kept[kept.length - 1];
      if (prev) {
        const dt = Math.abs(
          new Date(getCustomerOrderRecencyIso(order)).getTime() -
            new Date(getCustomerOrderRecencyIso(prev)).getTime(),
        );
        if (dt < PAID_TWIN_MS) continue;
      }
      kept.push(order);
    }
    kept.sort((a, b) => {
      const aAct = isActivatedCustomerStatus(a.status) ? 1 : 0;
      const bAct = isActivatedCustomerStatus(b.status) ? 1 : 0;
      if (aAct !== bAct) return bAct - aAct;
      const aActAt = a.activated_at ? new Date(a.activated_at).getTime() : 0;
      const bActAt = b.activated_at ? new Date(b.activated_at).getTime() : 0;
      if (aActAt !== bActAt) return bActAt - aActAt;
      return (
        new Date(getCustomerOrderRecencyIso(b)).getTime() -
        new Date(getCustomerOrderRecencyIso(a)).getTime()
      );
    });
    picked.push(...kept);
  }

  return sortOrdersNewestFirst([...rest, ...picked]);
}

function finalizeCustomerOrders(orders: CustomerOrderView[]): CustomerOrderView[] {
  return collapseDuplicatePaidLikeOrders(collapseDuplicateUnpaidOrders(dedupeOrders(orders)));
}

function isGptOrderProduct(product: string): boolean {
  return !isSpotifyProduct(product);
}

export async function loadCustomerOrdersForUser(params: {
  siteSlug: SiteSlug;
  userId: string;
  userEmail: string | null;
  /** Переиспользуем сессию со страницы — не создаём клиент повторно. */
  sessionClient?: SupabaseClient;
}): Promise<CustomerOrderView[]> {
  const { siteSlug, userId, userEmail } = params;

  if (siteSlug === "subs-store") {
    const supabase =
      params.sessionClient ?? (await createSiteSessionClient(siteSlug)).browserLike;
    return loadSubsCustomerOrders(supabase, userId, userEmail);
  }

  return loadGptCustomerOrders(userId, userEmail);
}

export async function loadCustomerOrdersWithFocus(params: {
  siteSlug: SiteSlug;
  userId: string;
  userEmail: string | null;
  orderFocusId?: string | null;
  sessionClient?: SupabaseClient;
}): Promise<{
  orders: CustomerOrderView[];
  focusedOrder?: CustomerOrderView;
  orderFocusMissing: boolean;
}> {
  let orders = await loadCustomerOrdersForUser({
    siteSlug: params.siteSlug,
    userId: params.userId,
    userEmail: params.userEmail,
    sessionClient: params.sessionClient,
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
      orders = finalizeCustomerOrders([fetched, ...orders]);
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
  const admin = tryCreateAdminClient();
  if (!admin) return [];

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
  let rawRows = filterOrdersBySite((byUser ?? []) as { product: string }[], "gpt-store") as Record<
    string,
    unknown
  >[];

  const email = normalizeEmail(userEmail);
  if (email) {
    let emailQuery = admin
      .from("orders")
      .select("*")
      .eq("account_email", email)
      .order("created_at", { ascending: false })
      .limit(50);

    if (siteId) {
      emailQuery = emailQuery.or(`site_id.eq.${siteId},site_id.is.null`) as typeof emailQuery;
    }

    const { data: byAccountEmail } = await emailQuery;
    const emailRows = filterOrdersBySite(
      (byAccountEmail ?? []) as { product: string }[],
      "gpt-store",
    ) as Record<string, unknown>[];

    const byId = new Map<string, Record<string, unknown>>();
    for (const row of [...rawRows, ...emailRows]) {
      byId.set(String(row.id), row);
    }
    rawRows = [...byId.values()];

    const orphanIds = emailRows
      .filter((o) => !o.user_id)
      .map((o) => String(o.id));
    if (orphanIds.length) {
      await admin.from("orders").update({ user_id: userId }).in("id", orphanIds);
    }
  }

  const normalized = rawRows
    .filter((row) => orderOwnedByUser({ row, userId, userEmail: email || null }))
    .map((r) => normalizeGptOrderRow(r));
  return finalizeCustomerOrders(normalized);
}

async function loadSubsCustomerOrders(
  _supabase: SupabaseClient,
  userId: string,
  userEmail: string | null,
): Promise<CustomerOrderView[]> {
  const subsAdmin = createSubsStoreAdminClient();
  if (!subsAdmin) return [];

  const email = normalizeEmail(userEmail);
  const byId = new Map<string, Record<string, unknown>>();

  const { data: byUserId } = await subsAdmin
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  for (const row of (byUserId ?? []) as Record<string, unknown>[]) {
    byId.set(String(row.id), row);
  }

  if (email) {
    const [{ data: byCustomerEmail }, { data: byAccountEmail }] = await Promise.all([
      subsAdmin
        .from("orders")
        .select("*")
        .ilike("customer_email", email)
        .order("created_at", { ascending: false })
        .limit(50),
      subsAdmin
        .from("orders")
        .select("*")
        .ilike("account_email", email)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    for (const row of [...(byCustomerEmail ?? []), ...(byAccountEmail ?? [])] as Record<
      string,
      unknown
    >[]) {
      if (!orderOwnedByUser({ row, userId, userEmail: email })) continue;
      byId.set(String(row.id), row);
    }

    const orphanIds = [...byId.values()]
      .filter((o) => !o.user_id && orderOwnedByUser({ row: o, userId, userEmail: email }))
      .map((o) => String(o.id));
    if (orphanIds.length) {
      await subsAdmin.from("orders").update({ user_id: userId }).in("id", orphanIds);
    }
  }

  const rawRows = [...byId.values()].filter((row) =>
    orderOwnedByUser({ row, userId, userEmail: email || null }),
  );

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

  return finalizeCustomerOrders(
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

    if (!orderOwnedByUser({ row: row as Record<string, unknown>, userId, userEmail })) {
      return null;
    }

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

  const admin = tryCreateAdminClient();
  if (!admin) return null;

  const { data: row } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!row) return null;

  const product = String(row.product ?? "");
  if (!isGptOrderProduct(product)) return null;

  if (!orderOwnedByUser({ row: row as Record<string, unknown>, userId, userEmail })) {
    return null;
  }

  if (!row.user_id && userId) {
    await admin.from("orders").update({ user_id: userId }).eq("id", orderId);
  }

  return normalizeGptOrderRow(row as Record<string, unknown>);
}
