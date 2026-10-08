import type { User } from "@supabase/supabase-js";

import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { peekGptProfileRole } from "@/lib/auth/peek-profile-role";
import { resolveServerRole } from "@/lib/auth/server-role";
import type { UserRole } from "@/types/database";

const ROLE_TTL_MS = 180_000;
const STALE_TTL_MS = 30 * 60_000;
const roleMemo = new Map<string, { role: UserRole; at: number }>();

function recalled(userId: string, allowStale = false): UserRole | null {
  const hit = roleMemo.get(userId);
  if (!hit) return null;
  const age = Date.now() - hit.at;
  if (age <= ROLE_TTL_MS) return hit.role;
  if (allowStale && age <= STALE_TTL_MS) return hit.role;
  if (!allowStale) roleMemo.delete(userId);
  return null;
}

export function rememberGptStaffRole(userId: string, role: UserRole): UserRole {
  roleMemo.set(userId, { role, at: Date.now() });
  return role;
}

export async function resolveGptStaffRole(user: User | null): Promise<UserRole> {
  if (!user) return "client";
  const fast = fastStaffRoleFromEmail(user.email);
  if (fast) return rememberGptStaffRole(user.id, fast);

  const cached = recalled(user.id);
  if (cached) return cached;

  const peeked = await peekGptProfileRole(user.id, 5_000);
  if (peeked === "admin" || peeked === "operator") {
    return rememberGptStaffRole(user.id, peeked);
  }

  const stale = recalled(user.id, true);
  if (stale === "admin" || stale === "operator") return stale;

  try {
    const full = await Promise.race([
      resolveServerRole(user),
      new Promise<UserRole>((_, reject) => {
        setTimeout(() => reject(new Error("staff_role_timeout")), 4_000);
      }),
    ]);
    return rememberGptStaffRole(user.id, full);
  } catch {
    if (stale) return stale;
    if (peeked === "client") return rememberGptStaffRole(user.id, "client");
    return "client";
  }
}
