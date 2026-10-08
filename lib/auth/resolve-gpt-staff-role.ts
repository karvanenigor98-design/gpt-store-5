import type { User } from "@supabase/supabase-js";

import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { peekGptProfileRole } from "@/lib/auth/peek-profile-role";
import { resolveServerRole } from "@/lib/auth/server-role";
import type { UserRole } from "@/types/database";

const ROLE_TTL_MS = 180_000;
const roleMemo = new Map<string, { role: UserRole; at: number }>();

function recalled(userId: string): UserRole | null {
  const hit = roleMemo.get(userId);
  if (!hit) return null;
  if (Date.now() - hit.at > ROLE_TTL_MS) {
    roleMemo.delete(userId);
    return null;
  }
  return hit.role;
}

function remember(userId: string, role: UserRole): UserRole {
  roleMemo.set(userId, { role, at: Date.now() });
  return role;
}

export async function resolveGptStaffRole(user: User | null): Promise<UserRole> {
  if (!user) return "client";
  const fast = fastStaffRoleFromEmail(user.email);
  if (fast) return fast;

  const cached = recalled(user.id);
  if (cached) return cached;

  const peeked = await peekGptProfileRole(user.id, 800);
  if (peeked === "admin" || peeked === "operator" || peeked === "client") {
    return remember(user.id, peeked);
  }

  try {
    return remember(user.id, await resolveServerRole(user));
  } catch {
    return "client";
  }
}
