import type { User } from "@supabase/supabase-js";

import { staffPanelHome } from "@/lib/auth/staff-access";
import { resolveServerRole } from "@/lib/auth/server-role";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { syncProfileRoleForUser } from "@/lib/auth/syncProfileRole";
import { tryCreateClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type DashboardStaffContext = {
  role: UserRole;
  panelHref: "/admin" | "/operator" | null;
};

/**
 * Синхронизирует роль в GPT profiles и возвращает ссылку на staff-панель (если есть).
 * Для subs-store дополнительно проверяет GPT-сессию (админка всегда на GPT Auth).
 */
export async function resolveDashboardStaffContext(
  siteSlug: SiteSlug,
  sessionUser: User,
): Promise<DashboardStaffContext> {
  if (siteSlug === "gpt-store") {
    let role: UserRole = "client";
    try {
      role = await syncProfileRoleForUser(sessionUser.id, sessionUser.email ?? null);
    } catch {
      role = await resolveServerRole(sessionUser);
    }
    return { role, panelHref: staffPanelHome(role) };
  }

  const gpt = await tryCreateClient();
  if (!gpt) {
    return { role: "client", panelHref: null };
  }

  const {
    data: { user: gptUser },
  } = await gpt.auth.getUser();

  if (!gptUser) {
    return { role: "client", panelHref: null };
  }

  let role: UserRole = "client";
  try {
    role = await syncProfileRoleForUser(gptUser.id, gptUser.email ?? null);
  } catch {
    role = await resolveServerRole(gptUser);
  }

  return { role, panelHref: staffPanelHome(role) };
}
