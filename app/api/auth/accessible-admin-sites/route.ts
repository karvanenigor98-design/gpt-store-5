import { NextResponse } from "next/server";

import { listAccessibleAdminSiteSlugs } from "@/lib/admin/subs-api-guard";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { resolveServerRole } from "@/lib/auth/server-role";

export const dynamic = "force-dynamic";

/**
 * GET — какие сайты видит текущий пользователь в общей админке (GPT STORE shell).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ sites: ["gpt-store"] as const });
  }

  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ sites: ["gpt-store"] as const });
  }

  const gptAdmin = createAdminClient();
  const sites = await listAccessibleAdminSiteSlugs(user, gptAdmin, role);
  return NextResponse.json({ sites });
}
