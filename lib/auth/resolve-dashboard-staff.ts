import type { User } from "@supabase/supabase-js";

import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { staffPanelHome } from "@/lib/auth/staff-access";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import type { UserRole } from "@/types/database";

export type DashboardStaffContext = {
  role: UserRole;
  panelHref: "/admin" | "/operator" | null;
};

/** Роль только из email/env — без profiles/GoTrue на каждый клик по кабинету. */
export async function resolveDashboardStaffContext(
  _siteSlug: SiteSlug,
  sessionUser: User,
): Promise<DashboardStaffContext> {
  const role: UserRole = fastStaffRoleFromEmail(sessionUser.email) ?? "client";
  return { role, panelHref: staffPanelHome(role) };
}
