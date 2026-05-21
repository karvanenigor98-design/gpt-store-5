import { NextResponse } from "next/server";

import { resolvePostLoginPath } from "@/lib/auth/postLoginPath";
import { syncProfileRoleForUser } from "@/lib/auth/syncProfileRole";
import { syncSubsProfileRoleForUser } from "@/lib/auth/subsProfileSync";
import { createClient } from "@/lib/supabase/server";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";

type Body = {
  returnUrl?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const rawReturnUrl = typeof body.returnUrl === "string" ? body.returnUrl : "/cabinet";
  const returnUrl =
    rawReturnUrl.startsWith("/") && !rawReturnUrl.startsWith("//") ? rawReturnUrl : "/cabinet";

  const authSite = request.headers.get("x-auth-site");
  const useSubs =
    authSite === "subs-store" ||
    returnUrl.includes("/spotify") ||
    returnUrl.includes("site=subs-store");

  if (useSubs) {
    const subs = await createSubsAuthServerClient();
    if (!subs) {
      return NextResponse.json({ error: "subs_not_configured" }, { status: 503 });
    }
    const {
      data: { user },
      error,
    } = await subs.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "no_user" }, { status: 401 });
    }
    try {
      const role = await syncSubsProfileRoleForUser(user.id, user.email ?? null);
      const path = resolvePostLoginPath(returnUrl, role);
      return NextResponse.json({ path });
    } catch {
      return NextResponse.json({ error: "sync" }, { status: 500 });
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "no_user" }, { status: 401 });
  }

  try {
    const role = await syncProfileRoleForUser(user.id, user.email ?? null);
    const path = resolvePostLoginPath(returnUrl, role);
    return NextResponse.json({ path });
  } catch {
    return NextResponse.json({ error: "sync" }, { status: 500 });
  }
}
