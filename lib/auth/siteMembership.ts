/**
 * Site Membership helpers.
 * Tracks which sites a user has registered with.
 * Uses `site_memberships` table (text slug, not UUID FK) for simplicity.
 * Gracefully degrades if the table doesn't exist yet (migration not applied).
 */

import { createAdminClient } from "@/lib/supabase/server";

export type SiteMembershipRole = "customer" | "operator" | "admin";

/**
 * Creates or updates a site membership entry for the user.
 * Called after login / registration to record site context.
 * Silent on DB errors (table may not exist before migration).
 */
export async function upsertSiteMembership(
  userId: string,
  siteSlug: string,
  role: SiteMembershipRole = "customer",
): Promise<void> {
  if (!userId || !siteSlug) return;
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.from("site_memberships") as any).upsert(
      { user_id: userId, site_slug: siteSlug, role },
      { onConflict: "user_id,site_slug", ignoreDuplicates: false },
    );
  } catch {
    // Table may not exist yet — silent degradation
  }
}

/**
 * Checks if a user has membership for the given site.
 *
 * Rules:
 *   - Super admin (nbuzanov0@mail.ru) always has access everywhere.
 *   - GPT STORE (gpt-store): fail-open — сессия GPT Auth достаточна.
 *   - Subs Store (subs-store): fail-open — сессия Subs Auth достаточна (отдельный проект).
 *   - Other sites: strict check.
 */
export async function hasSiteMembership(
  userId: string,
  userEmail: string | null | undefined,
  siteSlug: string,
): Promise<boolean> {
  // Super admin always has access everywhere
  if (userEmail === "nbuzanov0@mail.ru") return true;

  // Кабинет каждого магазина проверяется своей сессией в layout; membership не блокирует Subs-only users.
  if (siteSlug === "gpt-store" || siteSlug === "subs-store") return true;

  // Прочие сайты: проверка membership, с fail-open при ошибках БД
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("site_memberships") as any)
      .select("id")
      .eq("user_id", userId)
      .eq("site_slug", siteSlug)
      .maybeSingle();

    if (error) {
      if (error.message?.includes("does not exist") || error.message?.includes("relation")) {
        return true;
      }
      return true;
    }

    return Boolean(data);
  } catch {
    return true;
  }
}
