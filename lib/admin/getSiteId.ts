/**
 * Helper to resolve site UUID from slug.
 * Used in admin server pages/routes where DB columns expect UUID (not text slug).
 * Caches per-request since module-level cache persists across serverless cold starts.
 */

import { createAdminClient } from "@/lib/supabase/server";

/** Returns UUID of the site for the given slug, or null if not found / sites table missing. */
export async function getSiteUUID(slug: string): Promise<string | null> {
  if (!slug) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sites")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    return data.id as string;
  } catch {
    return null;
  }
}
