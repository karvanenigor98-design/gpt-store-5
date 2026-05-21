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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const role: UserRole = await resolveServerRole(user);
  if (role === "operator") {
    redirect("/operator");
  }
  if (role !== "admin") {
    redirect("/dashboard");
  }
  return { role: "admin" };
}
