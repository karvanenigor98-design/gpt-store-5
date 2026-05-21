/**
 * Dashboard: заказы/выручка/отзывы/чат — проект Supabase Subs (`subsAdmin`).
 * Счётчик «Зарегистрировано»: Supabase Auth проекта Subs (не фильтр по GPT site_memberships).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countSubsProjectAuthRegistrationsBetween,
  countSubsProjectAuthUsers,
} from "@/lib/admin/subs-auth-metrics";
import type { AdminOverviewStats } from "@/lib/admin/revenue-stats";
import {
  moscowDayEndIso,
  moscowDayStartIso,
  moscowMonthStartYmd,
  moscowTodayYmd,
} from "@/lib/admin/revenue-stats";

type SubsAdmin = SupabaseClient;

/** Paid revenue in Subs Store: orders with successful payment. */
async function sumSubsPaidRevenue(admin: SubsAdmin, fromIso: string | undefined, toIso: string | undefined) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = admin.from("orders").select("final_price").eq("payment_status", "paid");
  if (fromIso) q = q.gte("created_at", fromIso);
  if (toIso) q = q.lte("created_at", toIso);
  const { data, error } = await q;
  if (error || !data) return 0;
  return (data as { final_price: number }[]).reduce((s, row) => s + Number(row.final_price ?? 0), 0);
}

/** Orders created in range (all Subs orders belong to this shop). */
async function countSubsOrdersCreated(admin: SubsAdmin, fromIso: string, toIso: string) {
  const { count, error } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  if (error) return 0;
  return count ?? 0;
}

export async function loadSubsStoreOverviewStats(subsAdmin: SubsAdmin, now = new Date()): Promise<AdminOverviewStats> {
  const todayYmd = moscowTodayYmd(now);
  const dayStart = moscowDayStartIso(todayYmd);
  const dayEnd = moscowDayEndIso(todayYmd);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = moscowDayStartIso(moscowMonthStartYmd(now));

  const [revenueToday, revenue7d, revenueMonth, revenueAll, ordersToday, newClientsToday] = await Promise.all([
    sumSubsPaidRevenue(subsAdmin, dayStart, dayEnd),
    sumSubsPaidRevenue(subsAdmin, sevenDaysAgo, undefined),
    sumSubsPaidRevenue(subsAdmin, monthStart, undefined),
    sumSubsPaidRevenue(subsAdmin, undefined, undefined),
    countSubsOrdersCreated(subsAdmin, dayStart, dayEnd),
    countSubsProjectAuthRegistrationsBetween(subsAdmin, dayStart, dayEnd),
  ]);

  return {
    todayYmd,
    revenueToday,
    revenue7d,
    revenueMonth,
    revenueAll,
    ordersToday,
    newClientsToday,
  };
}

export type SubsDashboardBlockMetrics = {
  overview: AdminOverviewStats;
  totalOrders: number;
  pendingOrders: number;
  activeOrders: number;
  openChats: number;
  pendingReviews: number;
  totalClients: number;
  unreadClientMsgs: number;
};

async function subsOpenChatsFromSubs(subsAdmin: SubsAdmin): Promise<number> {
  const { count } = await subsAdmin
    .from("chat_threads")
    .select("id", { count: "exact", head: true })
    .neq("status", "closed");
  return count ?? 0;
}

async function subsUnreadClientMsgsFromSubs(subsAdmin: SubsAdmin): Promise<number> {
  const { count } = await subsAdmin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("author_role", "customer")
    .is("read_at", null);
  return count ?? 0;
}

export async function loadSubsStoreDashboardBlock(subsAdmin: SubsAdmin, now = new Date()): Promise<SubsDashboardBlockMetrics> {
  const overview = await loadSubsStoreOverviewStats(subsAdmin, now);

  const [
    { count: totalOrders },
    { count: pendingOrders },
    { count: activeOrders },
    openChats,
    { count: pendingReviews },
    totalClientsAuth,
    unreadClientMsgs,
  ] = await Promise.all([
    subsAdmin.from("orders").select("id", { count: "exact", head: true }),
    subsAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .or("status.eq.awaiting_payment,payment_status.eq.pending"),
    subsAdmin.from("orders").select("id", { count: "exact", head: true }).in("status", ["activated", "completed"]),
    subsOpenChatsFromSubs(subsAdmin),
    subsAdmin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
    countSubsProjectAuthUsers(subsAdmin),
    subsUnreadClientMsgsFromSubs(subsAdmin),
  ]);

  return {
    overview,
    totalOrders: totalOrders ?? 0,
    pendingOrders: pendingOrders ?? 0,
    activeOrders: activeOrders ?? 0,
    openChats,
    pendingReviews: pendingReviews ?? 0,
    totalClients: totalClientsAuth,
    unreadClientMsgs,
  };
}
