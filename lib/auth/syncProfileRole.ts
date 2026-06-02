import { resolveRoleByEmail } from "@/lib/auth/resolveRole";
import {
  loadStaffRoleFromAudit,
  loadStaffRoleFromSiteMemberships,
  mergeStaffRoles,
  profileRoleToSiteMembershipRole,
} from "@/lib/auth/staffRoleRestore";
import { isSuperAdminEmail } from "@/lib/auth/superAdmin";
import { upsertSiteMembership } from "@/lib/auth/siteMembership";
import { tryCreateAdminClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

/**
 * Обновляет роль и last_seen в profiles по правилам env + super-admin + восстановление staff.
 */
export async function syncProfileRoleForUser(userId: string, userEmail: string | null): Promise<UserRole> {
  const envRole = resolveRoleByEmail(userEmail);

  if (isSuperAdminEmail(userEmail)) {
    const role: UserRole = "admin";
    await persistProfileRole(userId, userEmail, role);
    return role;
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return envRole;
  }

  const { data: row } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  const dbRole = (row?.role ?? "client") as UserRole;

  if (dbRole === "admin" || dbRole === "operator" || dbRole === "client") {
    const effective = isSuperAdminEmail(userEmail) ? "admin" : dbRole;
    await persistProfileRole(userId, userEmail, effective, admin);
    return effective;
  }

  const [membershipRole, auditRole] = await Promise.all([
    loadStaffRoleFromSiteMemberships(admin, userId),
    loadStaffRoleFromAudit(admin, userId),
  ]);

  const role = mergeStaffRoles(dbRole, envRole, membershipRole ?? "client", auditRole ?? "client");

  await persistProfileRole(userId, userEmail, role, admin);
  return role;
}

async function persistProfileRole(
  userId: string,
  userEmail: string | null,
  role: UserRole,
  adminClient?: ReturnType<typeof tryCreateAdminClient>,
): Promise<void> {
  const admin = adminClient ?? tryCreateAdminClient();
  if (!admin) return;

  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      email: userEmail,
      role,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Failed to sync role: ${error.message}`);
  }

  if (role === "admin" || role === "operator") {
    await upsertSiteMembership(userId, "gpt-store", profileRoleToSiteMembershipRole(role));
  }
}
