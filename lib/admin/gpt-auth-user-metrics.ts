/**
 * Счётчики зарегистрированных пользователей из Supabase Auth (GPT-проект)
 * через auth.admin.listUsers — без опоры только на profiles.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient;

async function subsStoreMembershipUserIds(gptAdmin: Admin): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (gptAdmin.from("site_memberships") as any)
      .select("user_id")
      .eq("site_slug", "subs-store");

    if (error) return ids;
    for (const row of data ?? []) {
      const uid = (row as { user_id?: string }).user_id;
      if (uid) ids.add(String(uid));
    }
  } catch {
    /* таблицы может не быть */
  }
  return ids;
}

/**
 * Количество зарегистрированных пользователей GPT-проекта:
 * — gpt-store: все аккаунты Auth;
 * — subs-store: есть site_memberships (subs-store), либо user_id в переданном множестве заказов Subs-базы.
 */
export async function countAuthUsersForAdminSite(
  gptAdmin: Admin,
  siteSlug: "gpt-store" | "subs-store",
  subsExtraFromOrders?: Set<string>
): Promise<number> {
  let subsEligible: Set<string> | null = null;
  if (siteSlug === "subs-store") {
    subsEligible = await subsStoreMembershipUserIds(gptAdmin);
    if (subsExtraFromOrders?.size) {
      for (const id of subsExtraFromOrders) subsEligible.add(id);
    }
  }

  let total = 0;
  for (let page = 1; page <= 500; page += 1) {
    const { data, error } = await gptAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) break;
    const list = data?.users ?? [];
    if (!list.length) break;
    if (siteSlug === "gpt-store") {
      total += list.length;
    } else if (subsEligible) {
      for (const u of list) {
        if (subsEligible.has(u.id)) total += 1;
      }
    }
    if (list.length < 100) break;
  }
  return total;
}

/**
 * Новые регистрации за интервал по полю Auth user.created_at (UTC).
 */
export async function countAuthRegistrationsBetween(
  gptAdmin: Admin,
  siteSlug: "gpt-store" | "subs-store",
  fromIso: string,
  toIso: string,
  subsExtraFromOrders?: Set<string>
): Promise<number> {
  let subsEligible: Set<string> | null = null;
  if (siteSlug === "subs-store") {
    subsEligible = await subsStoreMembershipUserIds(gptAdmin);
    if (subsExtraFromOrders?.size) {
      for (const id of subsExtraFromOrders) subsEligible.add(id);
    }
  }
  const fromTs = new Date(fromIso).getTime();
  const toTs = new Date(toIso).getTime();

  let n = 0;
  for (let page = 1; page <= 500; page += 1) {
    const { data, error } = await gptAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) break;
    const list = data?.users ?? [];
    if (!list.length) break;
    for (const u of list) {
      if (siteSlug === "subs-store" && subsEligible && !subsEligible.has(u.id)) continue;
      const ct = u.created_at ? Date.parse(u.created_at) : NaN;
      if (!Number.isFinite(ct) || ct < fromTs || ct > toTs) continue;
      n += 1;
    }
    if (list.length < 100) break;
  }
  return n;
}
