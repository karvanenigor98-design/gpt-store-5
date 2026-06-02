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
    if (profileRole === "client" || profileRole === "operator" || profileRole === "admin") {
      return effectiveRoleFromProfile(profileRole, user.email);
    }

    const fromProfile = effectiveRoleFromProfile(profileRole, user.email);
    if (fromProfile === "admin" || fromProfile === "operator") {
      return fromProfile;
    }

    const [fromMembership, fromAudit] = await Promise.all([
      loadStaffRoleFromSiteMemberships(admin, user.id),
      loadStaffRoleFromAudit(admin, user.id),
    ]);
    const restored = mergeStaffRoles(
      fromProfile,
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
