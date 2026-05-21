import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

import { countAuthRegistrationsBetween } from "@/lib/admin/gpt-auth-user-metrics";

type Admin = SupabaseClient<Database>;

/** Заказы с этими статусами считаем оплаченными для выручки (без pending / failed / expired). */
const REVENUE_STATUSES = ["paid", "activating", "waiting_client", "active"] as const;

function formatMoscowYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Начало календарного дня по Москве (UTC+3) в ISO. */
export function moscowDayStartIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00+03:00`).toISOString();
}

/** Конец календарного дня по Москве. */
export function moscowDayEndIso(ymd: string): string {
  const start = new Date(`${ymd}T00:00:00+03:00`);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
}

export function moscowTodayYmd(now = new Date()): string {
  return formatMoscowYmd(now);
}

export function moscowMonthStartYmd(now = new Date()): string {
  const [y, m] = formatMoscowYmd(now).split("-");
  return `${y}-${m}-01`;
}

export async function sumOrderRevenue(
  admin: Admin,
  fromIso: string | undefined,
  toIso: string | undefined,
  siteSlug?: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = admin.from("orders").select("price").in("status", [...REVENUE_STATUSES]);
  if (fromIso) q = q.gte("created_at", fromIso);
  if (toIso) q = q.lte("created_at", toIso);
  if (siteSlug === "subs-store") q = q.ilike("product", "spotify%");
  else if (siteSlug === "gpt-store") q = q.not("product", "ilike", "spotify%");
  const { data, error } = (await q) as { data: { price: number }[] | null; error: Error | null };
  if (error || !data) return 0;
  return data.reduce((s, row) => s + Number(row.price ?? 0), 0);
}

export async function countOrdersCreated(
  admin: Admin,
  fromIso: string,
  toIso: string,
  siteSlug?: string
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  if (siteSlug === "subs-store") q = q.ilike("product", "spotify%");
  else if (siteSlug === "gpt-store") q = q.not("product", "ilike", "spotify%");
  const { count, error } = (await q) as { count: number | null; error: Error | null };
  if (error) return 0;
  return count ?? 0;
}

export async function countNewClients(admin: Admin, fromIso: string, toIso: string) {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "client")
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  if (error) return 0;
  return count ?? 0;
}

export type AdminOverviewStats = {
  todayYmd: string;
  /** Выручка */
  revenueToday: number;
  revenue7d: number;
  revenueMonth: number;
  revenueAll: number;
  /** Сегодня */
  ordersToday: number;
  newClientsToday: number;
};

export async function loadAdminOverviewStats(
  admin: Admin,
  now = new Date(),
  siteSlug?: string
): Promise<AdminOverviewStats> {
  const todayYmd = moscowTodayYmd(now);
  const dayStart = moscowDayStartIso(todayYmd);
  const dayEnd = moscowDayEndIso(todayYmd);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = moscowDayStartIso(moscowMonthStartYmd(now));

  const authSiteScope = siteSlug === "subs-store" ? "subs-store" : "gpt-store";

  const [revenueToday, revenue7d, revenueMonth, revenueAll, ordersToday, newClientsToday] = await Promise.all([
    sumOrderRevenue(admin, dayStart, dayEnd, siteSlug),
    sumOrderRevenue(admin, sevenDaysAgo, undefined, siteSlug),
    sumOrderRevenue(admin, monthStart, undefined, siteSlug),
    sumOrderRevenue(admin, undefined, undefined, siteSlug),
    countOrdersCreated(admin, dayStart, dayEnd, siteSlug),
    countAuthRegistrationsBetween(admin, authSiteScope, dayStart, dayEnd),
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
