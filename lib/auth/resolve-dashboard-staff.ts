import type { User } from "@supabase/supabase-js";

import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { peekGptProfileRole } from "@/lib/auth/peek-profile-role";
import { staffPanelHome } from "@/lib/auth/staff-access";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import type { UserRole } from "@/types/database";

export type DashboardStaffContext = {
  role: UserRole;
  panelHref: "/admin" | "/operator" | null;
};

/** Email/env сначала; profiles.role — короткий peek, без полного sync. */
export async function resolveDashboardStaffContext(
  _siteSlug: SiteSlug,
  sessionUser: User,
): Promise<DashboardStaffContext> {
  const fast = fastStaffRoleFromEmail(sessionUser.email);
  if (fast) return { role: fast, panelHref: staffPanelHome(fast) };

  const peeked = await peekGptProfileRole(sessionUser.id, 1_200);
  const role: UserRole = peeked === "admin" || peeked === "operator" ? peeked : "client";
  return { role, panelHref: staffPanelHome(role) };
}
