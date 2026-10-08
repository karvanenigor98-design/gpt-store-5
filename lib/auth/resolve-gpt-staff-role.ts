import type { User } from "@supabase/supabase-js";

import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { peekGptProfileRole } from "@/lib/auth/peek-profile-role";
import { resolveServerRole } from "@/lib/auth/server-role";
import type { UserRole } from "@/types/database";

export async function resolveGptStaffRole(user: User): Promise<UserRole> {
  const fast = fastStaffRoleFromEmail(user.email);
  if (fast) return fast;
  const peeked = await peekGptProfileRole(user.id, 1500);
  if (peeked === "admin" || peeked === "operator") return peeked;
  return resolveServerRole(user);
}
