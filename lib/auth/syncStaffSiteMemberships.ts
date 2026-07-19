import type { SupabaseClient } from "@supabase/supabase-js";

import { profileRoleToSiteMembershipRole } from "@/lib/auth/staffRoleRestore";
import type { UserRole } from "@/types/database";

const STAFF_SITES = ["gpt-store", "subs-store"] as const;

/**
 * Канонический доступ staff к витринам в GPT Supabase (site_memberships).
 * Переключатель магазинов и requireSubsStaffContext читают именно эту таблицу в GPT-проекте.
 */
export async function syncStaffSiteMembershipsInGpt(
  gptAdmin: SupabaseClient,
  userId: string,
  profileRole: UserRole,
): Promise<void> {
  if (profileRole !== "admin" && profileRole !== "operator") return;

  const membershipRole = profileRoleToSiteMembershipRole(profileRole);
  if (membershipRole === "customer") return;

  for (const site_slug of STAFF_SITES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (gptAdmin.from("site_memberships") as any).upsert(
        { user_id: userId, site_slug, role: membershipRole },
        { onConflict: "user_id,site_slug" },
      );
    } catch {
      /* таблица может отсутствовать до миграции */
    }
  }
}

/** Membership в БД конкретного магазина (GPT или Subs), если таблица есть. */
export async function upsertStaffSiteMembershipOnDb(
  db: SupabaseClient,
  userId: string,
  siteSlug: "gpt-store" | "subs-store",
  profileRole: UserRole,
): Promise<void> {
  if (profileRole !== "admin" && profileRole !== "operator") return;
  const membershipRole = profileRoleToSiteMembershipRole(profileRole);
  if (membershipRole === "customer") return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("site_memberships") as any).upsert(
      { user_id: userId, site_slug: siteSlug, role: membershipRole },
      { onConflict: "user_id,site_slug" },
    );
  } catch {
    /* optional */
  }
}

/**
 * Demotion to client: clear staff memberships so resolveServerRole
 * cannot resurrect operator/admin from stale site_memberships rows.
 */
export async function clearStaffSiteMembershipsInGpt(
  gptAdmin: SupabaseClient,
  userId: string,
): Promise<void> {
  for (const site_slug of STAFF_SITES) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (gptAdmin.from("site_memberships") as any).upsert(
        { user_id: userId, site_slug, role: "customer" },
        { onConflict: "user_id,site_slug" },
      );
    } catch {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (gptAdmin.from("site_memberships") as any)
          .delete()
          .eq("user_id", userId)
          .eq("site_slug", site_slug);
      } catch {
        /* optional */
      }
    }
  }
}

export async function clearStaffSiteMembershipOnDb(
  db: SupabaseClient,
  userId: string,
  siteSlug: "gpt-store" | "subs-store",
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from("site_memberships") as any).upsert(
      { user_id: userId, site_slug: siteSlug, role: "customer" },
      { onConflict: "user_id,site_slug" },
    );
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db.from("site_memberships") as any)
        .delete()
        .eq("user_id", userId)
        .eq("site_slug", siteSlug);
    } catch {
      /* optional */
    }
  }
}
