import { resolveRoleByEmail } from "@/lib/auth/resolveRole";
import { isSuperAdminEmail } from "@/lib/auth/superAdmin";
import { mergeStaffRoles } from "@/lib/auth/staffRoleRestore";
import { tryCreateAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import type { UserRole } from "@/types/database";

async function resolveGptStaffRole(params: {
  userId: string;
  userEmail: string | null;
}): Promise<UserRole> {
  const gptAdmin = tryCreateAdminClient();
  if (!gptAdmin) return "client";

  let best: UserRole = "client";
  try {
    const { data: byId } = await gptAdmin
      .from("profiles")
      .select("role, email")
      .eq("id", params.userId)
      .maybeSingle();
    const role = (byId?.role ?? null) as UserRole | null;
    if (role === "admin" || role === "operator") {
      best = mergeStaffRoles(best, role);
    }
  } catch {
    /* ignore */
  }

  const normalized = params.userEmail?.trim().toLowerCase();
  if (normalized) {
    try {
      const { data: byEmail } = await gptAdmin
        .from("profiles")
        .select("id, role")
        .ilike("email", normalized)
        .limit(5);
      const ids: string[] = [];
      for (const row of byEmail ?? []) {
        const role = (row as { role?: UserRole | null }).role ?? null;
        if (role === "admin" || role === "operator") {
          best = mergeStaffRoles(best, role);
        }
        const id = String((row as { id?: string }).id ?? "");
        if (id) ids.push(id);
      }
      if (ids.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: memberships } = await (gptAdmin.from("site_memberships") as any)
          .select("role")
          .in("user_id", ids)
          .in("role", ["admin", "operator"]);
        for (const row of memberships ?? []) {
          const role = (row as { role?: string }).role;
          if (role === "admin" || role === "operator") {
            best = mergeStaffRoles(best, role);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  return best;
}

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
  const gptStaffRole = await resolveGptStaffRole({ userId, userEmail });

  let role: UserRole = dbRole;
  if (isSuperAdminEmail(userEmail)) {
    role = "admin";
  } else if (dbRole === "admin" || dbRole === "operator") {
    role = dbRole;
  } else if (gptStaffRole === "admin" || gptStaffRole === "operator") {
    role = gptStaffRole;
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
