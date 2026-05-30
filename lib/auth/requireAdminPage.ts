import { redirect } from "next/navigation";

import { resolveServerRole } from "@/lib/auth/server-role";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

/**
 * Только admin: операторов и клиентов перенаправляем.
 */
export async function requireAdminPage(): Promise<{
  role: "admin";
}> {
  const supabase = await createClient();
  await supabase.auth.getSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?returnUrl=%2Fadmin&site=gpt-store");
  }
  const role: UserRole = await resolveServerRole(user);
  if (role === "operator") {
    redirect("/operator");
  }
  if (role !== "admin") {
    redirect("/dashboard?site=gpt-store");
  }
  return { role: "admin" };
}
