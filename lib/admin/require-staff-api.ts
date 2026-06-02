import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

import { resolveServerRole } from "@/lib/auth/server-role";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = await resolveServerRole(user);
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

/** GPT admin API: только role=admin (операторы — /operator и свои API). */
export async function requireAdminApi(): Promise<StaffApiContext | NextResponse> {
  const ctx = await requireStaffApi();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role !== "admin") {
    return NextResponse.json({ error: "Только администратор" }, { status: 403 });
  }
  return ctx;
}
