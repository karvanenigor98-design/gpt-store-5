import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import { resolveServerRole } from "@/lib/auth/server-role";
import { fastStaffRoleFromEmail } from "@/lib/auth/fast-staff-role";
import { peekGptProfileRole } from "@/lib/auth/peek-profile-role";
import { readGptCookieUser } from "@/lib/auth/read-gpt-cookie-user";
import { createClient, tryCreateAdminClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type StaffApiContext = {
  user: User;
  role: UserRole;
  admin: SupabaseClient;
};

/** Staff API: auth + admin client без throw при битом SERVICE_ROLE (503 вместо 500). */
export async function requireStaffApi(): Promise<StaffApiContext | NextResponse> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ error: "Auth не настроен на сервере" }, { status: 503 });
  }

  const { user } = await readGptCookieUser(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fast = fastStaffRoleFromEmail(user.email);
  const peeked = fast ?? (await peekGptProfileRole(user.id, 1500));
  const role =
    peeked === "admin" || peeked === "operator" ? peeked : await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Админ Supabase не настроен (SERVICE_ROLE_KEY)" },
      { status: 503 },
    );
  }

  return { user, role, admin };
}
