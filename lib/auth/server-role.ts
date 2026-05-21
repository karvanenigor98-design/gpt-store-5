import type { User } from "@supabase/supabase-js";

import { resolveRoleByEmail } from "@/lib/auth/resolveRole";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { effectiveRoleFromProfile } from "@/lib/auth/superAdmin";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { UserRole } from "@/types/database";

export async function resolveServerRole(user: User | null): Promise<UserRole> {
  if (!user) return "client";

  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    return effectiveRoleFromProfile(data?.role ?? null, user.email);
  } catch {
    return effectiveRoleFromProfile(null, user.email);
  }
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
