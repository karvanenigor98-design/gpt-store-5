import { resolveRoleByEmail } from "@/lib/auth/resolveRole";
import { isSuperAdminEmail } from "@/lib/auth/superAdmin";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { UserRole } from "@/types/database";

/**
 * Профиль в проекте Subs Store по auth.users.id (service role на сервере).
 */
export async function syncSubsProfileRoleForUser(
  userId: string,
  userEmail: string | null,
): Promise<UserRole> {
  const admin = createSubsStoreAdminClient();
  if (!admin) {
    console.warn("[subs-profile] SERVICE_ROLE или URL Subs не заданы — роль клиента без синхронизации.");
    return "client";
  }

  const { data: row } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  const dbRole = (row?.role ?? "client") as UserRole;

  const envRole = resolveRoleByEmail(userEmail);

  let role: UserRole = dbRole;
  if (isSuperAdminEmail(userEmail)) {
    role = "admin";
  } else if (dbRole === "admin" || dbRole === "operator") {
    role = dbRole;
  } else {
    role = envRole;
  }

  const payload: Record<string, unknown> = {
    id: userId,
    email: userEmail ?? null,
    role,
    last_seen: new Date().toISOString(),
  };

  const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("[subs-profile] upsert profiles failed:", error.message);
    throw new Error("Failed to sync subs profile");
  }

  return role;
}
