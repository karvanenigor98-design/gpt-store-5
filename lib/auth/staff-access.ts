import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";

import { cookies } from "next/headers";

import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { isSupabaseAuthCookieName } from "@/lib/auth/has-supabase-auth-cookie";
import { readGptAuthUserFromCookies } from "@/lib/auth/read-gpt-jwt-from-cookies";
import { resolveGptStaffRole } from "@/lib/auth/resolve-gpt-staff-role";
import { StaffAuthUnavailableError } from "@/lib/auth/staff-auth-errors";
import { staffLoginUrl } from "@/lib/auth/staff-auth-redirect";
import type { UserRole } from "@/types/database";

export type StaffPanel = "admin" | "operator";
export {
  resolveStaffAuthRedirect,
  staffLoginUrl,
  staffPanelHome,
} from "@/lib/auth/staff-auth-redirect";

async function gptAuthCookiePresent(): Promise<boolean> {
  try {
    const store = await cookies();
    return store.getAll().some((cookie) => isSupabaseAuthCookieName(cookie.name));
  } catch {
    return false;
  }
}

/**
 * JWT из cookie — без сетевого таймаута. Роль из profiles; таймаут роли
 * при живой сессии не равен «гостю» и не выкидывает на login.
 */
export const loadGptStaffAuth = cache(async (): Promise<{ user: User | null; role: UserRole }> => {
  const sessionUser = (await readGptAuthUserFromCookies()).user;

  if (sessionUser) {
    const fast = fastStaffRoleFromEmail(sessionUser.email);
    if (fast) return { user: sessionUser, role: fast };
    const role = await resolveGptStaffRole(sessionUser);
    return { user: sessionUser, role };
  }

  if (await gptAuthCookiePresent()) {
    throw new StaffAuthUnavailableError();
  }

  return { user: null, role: "client" };
});

export async function getGptStaffSessionUser(): Promise<User | null> {
  const auth = await loadGptStaffAuth();
  return auth.user;
}

/** Guard для /admin и /operator layouts — единая логика роли и login redirect. */
export async function requireStaffPanel(
  panel: StaffPanel,
  returnPath: string,
): Promise<{ user: User; role: StaffPanel }> {
  const auth = await loadGptStaffAuth();
  if (!auth.user) {
    redirect(staffLoginUrl(returnPath));
  }

  const role = auth.role;
  if (role === "admin") {
    if (panel === "operator") {
      redirect(returnPath.replace(/^\/operator/, "/admin") || "/admin");
    }
    return { user: auth.user, role: "admin" };
  }

  if (role === "operator") {
    if (panel === "admin") {
      redirect(returnPath.replace(/^\/admin/, "/operator") || "/operator");
    }
    return { user: auth.user, role: "operator" };
  }

  redirect("/dashboard?site=gpt-store");
}
