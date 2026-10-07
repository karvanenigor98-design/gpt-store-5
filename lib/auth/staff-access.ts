import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { redirect } from "next/navigation";

import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { peekGptProfileRole } from "@/lib/auth/peek-profile-role";
import { StaffAuthUnavailableError } from "@/lib/auth/staff-auth-errors";
import { staffLoginUrl } from "@/lib/auth/staff-auth-redirect";
import { resolveServerRole } from "@/lib/auth/server-role";
import { tryCreateClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type StaffPanel = "admin" | "operator";
export {
  resolveStaffAuthRedirect,
  staffLoginUrl,
  staffPanelHome,
} from "@/lib/auth/staff-auth-redirect";

const STAFF_SESSION_MS = 2_000;
const STAFF_USER_LOOKUP_MS = 3_500;
const STAFF_ROLE_LOOKUP_MS = 2_500;

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

function sessionStillFresh(expiresAt: number | undefined): boolean {
  if (!expiresAt) return false;
  return expiresAt * 1000 > Date.now() + 20_000;
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
  let expiresAt: number | undefined;
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), STAFF_SESSION_MS, "staff_session_timeout");
    sessionUser = data.session?.user ?? null;
    expiresAt = data.session?.expires_at;
  } catch {
    sessionUser = null;
  }

  const fastFromSession = sessionUser ? fastStaffRoleFromEmail(sessionUser.email) : null;
  if (sessionUser && fastFromSession && sessionStillFresh(expiresAt)) {
    return { user: sessionUser, role: fastFromSession };
  }

  if (sessionUser && sessionStillFresh(expiresAt)) {
    const peeked = await peekGptProfileRole(sessionUser.id, 1_500);
    if (peeked) {
      return { user: sessionUser, role: peeked };
    }
  }

  let user = sessionUser;
  try {
    const result = await withTimeout(supabase.auth.getUser(), STAFF_USER_LOOKUP_MS, "staff_user_timeout");
    user = result.data.user ?? null;
  } catch (err) {
    if (sessionUser && fastFromSession) {
      return { user: sessionUser, role: fastFromSession };
    }
    if (sessionUser) {
      const peeked = await peekGptProfileRole(sessionUser.id, 1_200);
      if (peeked) {
        return { user: sessionUser, role: peeked };
      }
      user = sessionUser;
    } else if (err instanceof Error && err.message === "staff_user_timeout") {
      throw new StaffAuthUnavailableError();
    } else {
      throw new StaffAuthUnavailableError();
    }
  }

  if (!user) {
    return { user: null, role: "client" };
  }

  const fast = fastStaffRoleFromEmail(user.email);
  if (fast) {
    return { user, role: fast };
  }

  const peeked = await peekGptProfileRole(user.id, 1_500);
  if (peeked) {
    return { user, role: peeked };
  }

  try {
    const role = await withTimeout(resolveServerRole(user), STAFF_ROLE_LOOKUP_MS, "staff_role_timeout");
    return { user, role };
  } catch {
    if (fastFromSession) {
      return { user, role: fastFromSession };
    }
    throw new StaffAuthUnavailableError();
  }
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
