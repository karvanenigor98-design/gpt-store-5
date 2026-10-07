import { tryCreateAdminClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

/** Короткий lookup profiles.role — без audit/memberships. */
export async function peekGptProfileRole(
  userId: string,
  timeoutMs = 1200,
): Promise<UserRole | null> {
  const admin = tryCreateAdminClient();
  if (!admin) return null;
  try {
    const query = admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    const timedOut = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
    const result = await Promise.race([query, timedOut]);
    if (!result || !("data" in result)) return null;
    const role = result.data?.role;
    if (role === "admin" || role === "operator" || role === "client") return role;
  } catch {
    return null;
  }
  return null;
}
