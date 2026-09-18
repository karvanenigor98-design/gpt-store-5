import type { SupabaseClient } from "@supabase/supabase-js";

import type { SiteMembershipRole } from "@/lib/auth/siteMembership";
import type { UserRole } from "@/types/database";

function roleRank(role: UserRole): number {
  if (role === "admin") return 3;
  if (role === "operator") return 2;
  return 1;
}

/** Берёт роль с максимальными правами (admin > operator > client). */
export function mergeStaffRoles(...roles: UserRole[]): UserRole {
  return roles.reduce<UserRole>(
    (best, next) => (roleRank(next) > roleRank(best) ? next : best),
    "client",
  );
}

export function profileRoleToSiteMembershipRole(role: UserRole): SiteMembershipRole {
  if (role === "admin") return "admin";
  if (role === "operator") return "operator";
  return "customer";
}

function membershipRoleToProfile(role: string | null | undefined): UserRole | null {
  if (role === "admin" || role === "operator") return role;
  return null;
}

/** Роль staff из site_memberships (если когда-то выдавали через админку). */
export async function loadStaffRoleFromSiteMemberships(
  admin: SupabaseClient,
  userId: string,
): Promise<UserRole | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("site_memberships") as any)
      .select("role")
      .eq("user_id", userId);

    if (error) return null;

    let best: UserRole | null = null;
    for (const row of data ?? []) {
      const mapped = membershipRoleToProfile((row as { role?: string }).role);
      if (mapped) best = mergeStaffRoles(best ?? "client", mapped);
    }
    return best;
  } catch {
    return null;
  }
}

/** Последняя роль из role_audit (set_role / grant_operator_by_email). */
export async function loadStaffRoleFromAudit(
  admin: SupabaseClient,
  userId: string,
): Promise<UserRole | null> {
  try {
    const { data, error } = await admin
      .from("role_audit")
      .select("action, payload")
      .eq("target_id", userId)
      .in("action", ["set_role", "grant_operator_by_email"])
      .order("created_at", { ascending: false })
      .limit(5);

    if (error || !data?.length) return null;

    for (const row of data) {
      const action = (row as { action?: string }).action;
      if (action === "grant_operator_by_email") {
        return "operator";
      }
      const to = (row as { payload?: { to?: string } | null }).payload?.to;
      if (to === "admin" || to === "operator" || to === "client") {
        return to;
      }
    }
    return null;
  } catch {
    return null;
  }
}
