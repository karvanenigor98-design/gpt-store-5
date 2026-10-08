import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";

import { cookies } from "next/headers";

import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { isSupabaseAuthCookieName } from "@/lib/auth/has-supabase-auth-cookie";
import { readGptCookieUser } from "@/lib/auth/read-gpt-cookie-user";
import { resolveGptStaffRole } from "@/lib/auth/resolve-gpt-staff-role";
import { StaffAuthUnavailableError } from "@/lib/auth/staff-auth-errors";
import { staffLoginUrl } from "@/lib/auth/staff-auth-redirect";
import { tryCreateClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type StaffPanel = "admin" | "operator";
export {
  resolveStaffAuthRedirect,
  staffLoginUrl,
  staffPanelHome,
} from "@/lib/auth/staff-auth-redirect";

const STAFF_SESSION_MS = 2_000;

async function gptAuthCookiePresent(): Promise<boolean> {
  try {
    const store = await cookies();
    return store.getAll().some((cookie) => isSupabaseAuthCookieName(cookie.name));
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Один probe на RSC-запрос.
 * Свежая JWT-сессия + email staff → сразу в панель, без Auth/DB round-trip.
 * Таймаут Auth не трактуем как «гость» (не выкидываем).
 */
export const loadGptStaffAuth = cache(async (): Promise<{ user: User | null; role: UserRole }> => {
  const supabase = await tryCreateClient();
  if (!supabase) {
    throw new StaffAuthUnavailableError("Supabase client unavailable");
  }

  let sessionUser: User | null = null;
  try {
    const cookieSession = await withTimeout(readGptCookieUser(supabase), STAFF_SESSION_MS, "staff_session_timeout");
    sessionUser = cookieSession.user;
  } catch {
    sessionUser = null;
  }

  const cookiePresent = await gptAuthCookiePresent();
  const fastFromSession = sessionUser ? fastStaffRoleFromEmail(sessionUser.email) : null;

  if (sessionUser) {
    if (fastFromSession) {
      return { user: sessionUser, role: fastFromSession };
    }
    try {
      return {
        user: sessionUser,
        role: await withTimeout(resolveGptStaffRole(sessionUser), 2_000, "staff_role_timeout"),
      };
    } catch {
      throw new StaffAuthUnavailableError();
    }
  }

  if (cookiePresent) {
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
