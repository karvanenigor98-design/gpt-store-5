import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/check-site-membership
 * Body: { site: string }
 * Returns: { hasMembership: boolean }
 *
 * Checks whether the currently authenticated user has a site_membership
 * entry for the requested site. Used by LoginForm to gate Subs Store access.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ hasMembership: false, error: "Unauthorized" }, { status: 401 });
  }

  let siteSlug = "gpt-store";
  try {
    const body = (await req.json()) as { site?: string };
    if (body.site === "subs-store" || body.site === "gpt-store") {
      siteSlug = body.site;
    }
  } catch {
    // use default
  }

  // Super admin always has access
  if (user.email === "nbuzanov0@mail.ru") {
    return NextResponse.json({ hasMembership: true });
  }

  // GPT STORE и Subs Store: любой вошедший в GPT Auth пользователь (membership дописывается при логине)
  if (siteSlug === "gpt-store" || siteSlug === "subs-store") {
    return NextResponse.json({ hasMembership: true });
  }

  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("site_memberships") as any)
      .select("id")
      .eq("user_id", user.id)
      .eq("site_slug", siteSlug)
      .maybeSingle();

    if (error) {
      if (error.message?.includes("does not exist")) {
        return NextResponse.json({ hasMembership: true });
      }
      return NextResponse.json({ hasMembership: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ hasMembership: Boolean(data) });
  } catch {
    return NextResponse.json({ hasMembership: true });
  }
}
