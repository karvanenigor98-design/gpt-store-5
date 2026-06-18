import type { User } from "@supabase/supabase-js";

import { resolveRoleByEmail } from "@/lib/auth/resolveRole";
import {
  loadStaffRoleFromAudit,
  loadStaffRoleFromSiteMemberships,
  mergeStaffRoles,
} from "@/lib/auth/staffRoleRestore";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { effectiveRoleFromProfile, isSuperAdminEmail } from "@/lib/auth/superAdmin";
import { tryCreateAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { UserRole } from "@/types/database";

function roleFromEnvFallback(email: string | null | undefined): UserRole {
  if (isSuperAdminEmail(email)) return "admin";
  const fromEnv = resolveRoleByEmail(email);
  return fromEnv === "admin" || fromEnv === "operator" ? fromEnv : "client";
}

async function loadStaffRoleByEmail(
  admin: NonNullable<ReturnType<typeof tryCreateAdminClient>>,
  email: string | null | undefined,
): Promise<UserRole | null> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const { data: profileRows } = await admin
      .from("profiles")
      .select("id, role")
      .ilike("email", normalized)
      .limit(5);

    const ids = (profileRows ?? [])
      .map((row) => String((row as { id?: string }).id ?? ""))
      .filter(Boolean);

    let best: UserRole = "client";
    for (const row of profileRows ?? []) {
      const mapped = effectiveRoleFromProfile((row as { role?: UserRole | null }).role ?? null, normalized);
      best = mergeStaffRoles(best, mapped);
    }

    if (ids.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membershipRows } = await (admin.from("site_memberships") as any)
        .select("role")
        .in("user_id", ids)
        .in("role", ["admin", "operator"]);
      for (const row of membershipRows ?? []) {
        const role = (row as { role?: string }).role;
        if (role === "admin" || role === "operator") {
          best = mergeStaffRoles(best, role);
        }
      }
    }

    return best === "admin" || best === "operator" ? best : null;
  } catch {
    return null;
  }
}

export async function resolveServerRole(user: User | null): Promise<UserRole> {
  if (!user) return "client";

  try {
    const admin = tryCreateAdminClient();
    if (!admin) {
      return roleFromEnvFallback(user.email);
    }
    const { data } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const profileRole = data?.role ?? null;
    if (profileRole === "admin" || profileRole === "operator") {
      return effectiveRoleFromProfile(profileRole, user.email);
    }

    const fromProfile = effectiveRoleFromProfile(profileRole, user.email);
    const fromEmail = await loadStaffRoleByEmail(admin, user.email);

    const [fromMembership, fromAudit] = await Promise.all([
      loadStaffRoleFromSiteMemberships(admin, user.id),
      loadStaffRoleFromAudit(admin, user.id),
    ]);
    const restored = mergeStaffRoles(
      fromProfile,
      fromEmail ?? "client",
      fromMembership ?? "client",
      fromAudit ?? "client",
      roleFromEnvFallback(user.email),
    );
    if (restored === "admin" || restored === "operator") {
      return restored;
    }
  } catch {
    const fromProfile = effectiveRoleFromProfile(null, user.email);
    if (fromProfile === "admin" || fromProfile === "operator") {
      return fromProfile;
    }
  }

  const effective = effectiveRoleFromProfile(null, user.email);
  if (effective === "admin" || effective === "operator") {
    return effective;
  }

  return roleFromEnvFallback(user.email);
}

/** Роли в личном кабинете: GPT-профиль или Subs-профиль (разные UUID). */
export async function resolveCabinetServerRole(
  siteSlug: SiteSlug,
  user: User | null,
): Promise<UserRole> {
  if (!user) return "client";

  if (siteSlug === "gpt-store") {
    return resolveServerRole(user);
  }

  const subsAdmin = createSubsStoreAdminClient();
  if (!subsAdmin) {
    return resolveRoleByEmail(user.email);
  }

  try {
    const { data } = await subsAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    return effectiveRoleFromProfile(data?.role ?? null, user.email);
  } catch {
    return effectiveRoleFromProfile(null, user.email);
  }
}

export async function isServerAdmin(user: User | null): Promise<boolean> {
  return (await resolveServerRole(user)) === "admin";
}
