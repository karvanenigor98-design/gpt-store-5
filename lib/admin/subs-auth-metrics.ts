/**
 * Количество пользователей Subs Store без полного скана auth.admin.listUsers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function countSubsProjectAuthUsers(subsAdmin: SupabaseClient): Promise<number> {
  const { count, error } = await subsAdmin.from("profiles").select("id", { count: "exact", head: true });
  if (!error) return count ?? 0;
  console.error("[subs-auth-metrics] profiles count:", error.message);
  return 0;
}

export async function countSubsProjectAuthRegistrationsBetween(
  subsAdmin: SupabaseClient,
  fromIso: string,
  toIso: string,
): Promise<number> {
  const { count, error } = await subsAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .gte("created_at", fromIso)
    .lte("created_at", toIso);
  if (!error) return count ?? 0;
  console.error("[subs-auth-metrics] registrations:", error.message);
  return 0;
}
