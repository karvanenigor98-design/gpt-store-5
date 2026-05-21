import type { User } from "@supabase/supabase-js";

import { listAccessibleAdminSiteSlugs } from "@/lib/admin/subs-api-guard";
import { normalizeAuthEmail } from "@/lib/auth/superAdmin";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { SiteSlug } from "@/lib/sites";
import type { UserRole } from "@/types/database";

export type StaffRecipient = {
  userId: string | null;
  email: string;
  role: "admin" | "operator";
};

async function profileStaffRows(): Promise<
  { id: string; email: string | null; role: UserRole }[]
> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("id, email, role")
      .in("role", ["admin", "operator"])
      .not("email", "is", null)
      .limit(300);
    return (data ?? []) as { id: string; email: string | null; role: UserRole }[];
  } catch {
    return [];
  }
}

async function userSiteAccessMap(): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_site_access")
      .select("user_id, site_id, can_receive_email_notifications, sites(slug)")
      .eq("can_receive_email_notifications", true)
      .limit(500);

    for (const row of data ?? []) {
      const uid = (row as { user_id?: string }).user_id;
      const sites = (row as { sites?: { slug?: string } | null }).sites;
      const slug = sites?.slug;
      if (!uid || !slug) continue;
      if (!map.has(uid)) map.set(uid, new Set());
      map.get(uid)!.add(slug);
    }
  } catch {
    /* table may be empty */
  }
  return map;
}

function parseEnvStaffEmails(): string[] {
  const out: string[] = [];
  const direct = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (direct) out.push(direct);
  for (const raw of [process.env.ADMIN_EMAILS, process.env.OPERATOR_EMAILS]) {
    if (!raw?.trim()) continue;
    for (const e of raw.split(",")) {
      const n = e.trim().toLowerCase();
      if (n) out.push(n);
    }
  }
  return [...new Set(out)];
}

/** Staff с доступом к siteSlug; исключает автора действия. */
export async function collectStaffRecipientsForSite(
  siteSlug: SiteSlug,
  options?: { excludeUserId?: string | null; excludeEmail?: string | null },
): Promise<StaffRecipient[]> {
  const excludeId = options?.excludeUserId ?? null;
  const excludeEmail = normalizeAuthEmail(options?.excludeEmail);
  const accessMap = await userSiteAccessMap();
  const rows = await profileStaffRows();
  const gptAdmin = createAdminClient();
  const out: StaffRecipient[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const email = normalizeAuthEmail(row.email);
    if (!email || seen.has(email)) continue;
    if (excludeId && row.id === excludeId) continue;
    if (excludeEmail && email === excludeEmail) continue;

    const pseudoUser = { id: row.id, email } as User;
    const sites = await listAccessibleAdminSiteSlugs(pseudoUser, gptAdmin, row.role);
    if (!sites.includes(siteSlug as "gpt-store" | "subs-store")) {
      const explicit = accessMap.get(row.id);
      if (explicit && !explicit.has(siteSlug)) continue;
      if (!explicit && row.role !== "admin") continue;
    }

    const role = row.role === "admin" ? "admin" : "operator";
    seen.add(email);
    out.push({ userId: row.id, email, role });
  }

  const subs = createSubsStoreAdminClient();
  if (subs && siteSlug === "subs-store") {
    try {
      const { data } = await subs
        .from("profiles")
        .select("id, email, role")
        .in("role", ["admin", "operator"])
        .not("email", "is", null)
        .limit(100);
      for (const row of data ?? []) {
        const email = normalizeAuthEmail((row as { email?: string }).email);
        if (!email || seen.has(email)) continue;
        if (excludeEmail && email === excludeEmail) continue;
        seen.add(email);
        out.push({
          userId: (row as { id: string }).id,
          email,
          role: (row as { role: string }).role === "admin" ? "admin" : "operator",
        });
      }
    } catch {
      /* ignore */
    }
  }

  for (const email of parseEnvStaffEmails()) {
    if (seen.has(email)) continue;
    if (excludeEmail && email === excludeEmail) continue;
    seen.add(email);
    out.push({ userId: null, email, role: "admin" });
  }

  return out;
}

export async function resolveCustomerEmailFromGptProfile(
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const fromProfile = profile?.email?.trim();
    if (fromProfile) return fromProfile.toLowerCase();

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const fromAuth = authUser?.user?.email?.trim();
    return fromAuth ? fromAuth.toLowerCase() : null;
  } catch {
    return null;
  }
}
