import { NextRequest, NextResponse } from "next/server";

import { previewUnpaidOrderCampaign } from "@/lib/email/unpaid-campaign";
import { resolveServerRole } from "@/lib/auth/server-role";
import { createClient } from "@/lib/supabase/server";
import type { SiteSlug } from "@/lib/sites";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await resolveServerRole(user);
  if (role !== "admin" && role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const siteSlug = (req.nextUrl.searchParams.get("site") === "subs-store"
    ? "subs-store"
    : "gpt-store") as SiteSlug;
  const period = req.nextUrl.searchParams.get("period") ?? "7d";

  const preview = await previewUnpaidOrderCampaign({ siteSlug, period });
  return NextResponse.json(preview);
}
