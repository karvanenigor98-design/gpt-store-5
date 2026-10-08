/**
 * Счётчики пользователей без auth.admin.listUsers (он сканирует все страницы Auth).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient;

async function countProfiles(
  gptAdmin: Admin,
  fromIso?: string,
  toIso?: string,
): Promise<number> {
  let q = gptAdmin.from("profiles").select("id", { count: "exact", head: true });
  if (fromIso) q = q.gte("created_at", fromIso);
  if (toIso) q = q.lte("created_at", toIso);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

async function countSubsMemberships(gptAdmin: Admin): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (gptAdmin.from("site_memberships") as any)
      .select("user_id", { count: "exact", head: true })
      .eq("site_slug", "subs-store");
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Количество зарегистрированных пользователей:
 * — gpt-store: profiles;
 * — subs-store: site_memberships (+ опционально id из заказов Subs).
 */
export async function countAuthUsersForAdminSite(
  gptAdmin: Admin,
  siteSlug: "gpt-store" | "subs-store",
  subsExtraFromOrders?: Set<string>,
): Promise<number> {
  if (siteSlug === "subs-store") {
    const memberships = await countSubsMemberships(gptAdmin);
    return memberships + (subsExtraFromOrders?.size ?? 0);
  }
  return countProfiles(gptAdmin);
}

/** Новые регистрации за интервал по profiles.created_at. */
export async function countAuthRegistrationsBetween(
  gptAdmin: Admin,
  siteSlug: "gpt-store" | "subs-store",
  fromIso: string,
  toIso: string,
  _subsExtraFromOrders?: Set<string>,
): Promise<number> {
  if (siteSlug === "subs-store") {
    return 0;
  }
  return countProfiles(gptAdmin, fromIso, toIso);
}
