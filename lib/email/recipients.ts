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
      .not("email", "is", null)
      .limit(800);
    return (data ?? []) as { id: string; email: string | null; role: UserRole }[];
  } catch {
    return [];
  }
}

async function membershipStaffRoleByUserId(siteSlug: SiteSlug): Promise<Map<string, "admin" | "operator">> {
  const out = new Map<string, "admin" | "operator">();
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin.from("site_memberships") as any)
      .select("user_id, role")
      .eq("site_slug", siteSlug)
      .in("role", ["admin", "operator"])
      .limit(800);
    for (const row of data ?? []) {
      const userId = String((row as { user_id?: string }).user_id ?? "");
      const role = (row as { role?: string }).role === "admin" ? "admin" : "operator";
      if (!userId) continue;
      const prev = out.get(userId);
      if (prev !== "admin") out.set(userId, role);
    }
  } catch {
    /* ignore */
  }
  return out;
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

function parseEnvStaffEmails(): { email: string; role: "admin" | "operator" }[] {
  const out: { email: string; role: "admin" | "operator" }[] = [];
  const seen = new Set<string>();

  const push = (raw: string | undefined, role: "admin" | "operator") => {
    const n = raw?.trim().toLowerCase();
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push({ email: n, role });
  };

  push(process.env.ADMIN_EMAIL, "admin");
  for (const e of (process.env.ADMIN_EMAILS ?? "").split(",")) push(e, "admin");
  push(process.env.OPERATOR_EMAIL, "operator");
  for (const e of (process.env.OPERATOR_EMAILS ?? "").split(",")) push(e, "operator");

  return out;
}

/** Staff с доступом к siteSlug; исключает автора действия. */
export async function collectStaffRecipientsForSite(
  siteSlug: SiteSlug,
  options?: { excludeUserId?: string | null; excludeEmail?: string | null },
): Promise<StaffRecipient[]> {
  const excludeId = options?.excludeUserId ?? null;
  const excludeEmail = normalizeAuthEmail(options?.excludeEmail);
  const membershipStaffRoles = await membershipStaffRoleByUserId(siteSlug);
  const accessMap = await userSiteAccessMap();
  const rows = await profileStaffRows();
  const out: StaffRecipient[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const email = normalizeAuthEmail(row.email);
    if (!email || seen.has(email)) continue;
    if (excludeId && row.id === excludeId) continue;
    if (excludeEmail && email === excludeEmail) continue;

    const hasStaffProfileRole = row.role === "admin" || row.role === "operator";
    const membershipRole = membershipStaffRoles.get(row.id);
    const hasStaffMembershipRole = Boolean(membershipRole);
    if (!hasStaffProfileRole && !hasStaffMembershipRole) {
      continue;
    }
    const role = row.role === "admin" || membershipRole === "admin" ? "admin" : "operator";
    const explicitAccess = accessMap.get(row.id);
    if (explicitAccess && !explicitAccess.has(siteSlug)) {
      continue;
    }

    /** Все staff получают уведомления обеих витрин (если нет явного opt-out в user_site_access). */
    if (role === "operator" || role === "admin") {
      seen.add(email);
      out.push({ userId: row.id, email, role });
      continue;
    }
  }

  const subs = createSubsStoreAdminClient();
  if (subs) {
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

  for (const { email, role } of parseEnvStaffEmails()) {
    if (seen.has(email)) continue;
    if (excludeEmail && email === excludeEmail) continue;
    seen.add(email);
    out.push({ userId: null, email, role });
  }

  return out;
}

/** Все staff-email (GPT + Subs), без дублей — для legacy notifyStaffEmails. */
export async function collectStaffEmailsForAllSites(options?: {
  excludeEmail?: string | null;
}): Promise<string[]> {
  const excludeEmail = normalizeAuthEmail(options?.excludeEmail);
  const merged = [
    ...(await collectStaffRecipientsForSite("gpt-store", { excludeEmail })),
    ...(await collectStaffRecipientsForSite("subs-store", { excludeEmail })),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of merged) {
    if (seen.has(r.email)) continue;
    seen.add(r.email);
    out.push(r.email);
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
