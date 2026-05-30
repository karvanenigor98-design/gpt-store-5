import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { resolveServerRole } from "@/lib/auth/server-role";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type StaffPanel = "admin" | "operator";

export function staffPanelHome(role: UserRole): "/admin" | "/operator" | null {
  if (role === "admin") return "/admin";
  if (role === "operator") return "/operator";
  return null;
}

export function staffLoginUrl(returnPath: string): string {
  const safe =
    returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : "/admin";
  return `/login?returnUrl=${encodeURIComponent(safe)}&site=gpt-store`;
}

/** Куда отправить уже авторизованного staff после /login. */
export function resolveStaffAuthRedirect(role: UserRole, returnUrl: string | null | undefined): string {
  const safe =
    returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//") ? returnUrl : "";

  if (role === "admin") {
    if (safe.startsWith("/operator")) return "/admin";
    if (safe.startsWith("/admin")) return safe;
    return "/admin";
  }

  if (role === "operator") {
    if (safe.startsWith("/admin")) return safe.replace(/^\/admin/, "/operator") || "/operator";
    if (safe.startsWith("/operator")) return safe;
    return "/operator";
  }

  return resolvePostLoginPath(safe || "/dashboard?site=gpt-store", role);
}

export async function getGptStaffSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Guard для /admin и /operator layouts — единая логика роли и login redirect. */
export async function requireStaffPanel(
  panel: StaffPanel,
  returnPath: string,
): Promise<{ user: User; role: StaffPanel }> {
  const user = await getGptStaffSessionUser();
  if (!user) {
    redirect(staffLoginUrl(returnPath));
  }

  const role = await resolveServerRole(user);
  if (role === "admin") {
    if (panel === "operator") {
      redirect(returnPath.replace(/^\/operator/, "/admin") || "/admin");
    }
    return { user, role: "admin" };
  }

  if (role === "operator") {
    if (panel === "admin") {
      redirect(returnPath.replace(/^\/admin/, "/operator") || "/operator");
    }
    return { user, role: "operator" };
  }

  redirect("/dashboard?site=gpt-store");
}
