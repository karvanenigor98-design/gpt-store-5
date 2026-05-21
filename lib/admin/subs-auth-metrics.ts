/**
 * Количество пользователей Supabase Auth в проекте Subs Store (отдельный Supabase).
 * Только server-side; использует service-role клиент subs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function countSubsProjectAuthUsers(subsAdmin: SupabaseClient): Promise<number> {
  let total = 0;
  for (let page = 1; page <= 500; page += 1) {
    const { data, error } = await subsAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.error("[subs-auth-metrics] auth.admin.listUsers:", error.message);
      break;
    }
    const list = data?.users ?? [];
    if (!list.length) break;
    total += list.length;
    if (list.length < 100) break;
  }
  return total;
}

export async function countSubsProjectAuthRegistrationsBetween(
  subsAdmin: SupabaseClient,
  fromIso: string,
  toIso: string,
): Promise<number> {
  const fromTs = new Date(fromIso).getTime();
  const toTs = new Date(toIso).getTime();
  let n = 0;
  for (let page = 1; page <= 500; page += 1) {
    const { data, error } = await subsAdmin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) {
      console.error("[subs-auth-metrics] registrations listUsers:", error.message);
      break;
    }
    const list = data?.users ?? [];
    if (!list.length) break;
    for (const u of list) {
      const ct = u.created_at ? Date.parse(u.created_at) : NaN;
      if (!Number.isFinite(ct) || ct < fromTs || ct > toTs) continue;
      n += 1;
    }
    if (list.length < 100) break;
  }
  return n;
}
