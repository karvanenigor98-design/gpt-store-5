import { type NextRequest, NextResponse } from "next/server";
import { tryCreateClient } from "@/lib/supabase/server";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import {
  applySiteUiLogoutFromRequest,
  clearAllSiteUiLogouts,
  resolveSiteFromRequest,
} from "@/lib/auth/siteUiSession";

function redirectAfterSignout(request: NextRequest, site: "gpt-store" | "subs-store"): string {
  if (site === "subs-store") return "/spotify";
  return "/";
}

export async function POST(request: NextRequest) {
  const global = request.nextUrl.searchParams.get("global") === "1";
  const site = resolveSiteFromRequest(
    request.nextUrl.pathname,
    request.nextUrl.searchParams.get("site"),
    request.cookies.get("current_site")?.value
  );

  const redirectPath = redirectAfterSignout(request, site);
  const response = NextResponse.redirect(new URL(redirectPath, request.url));

  if (global) {
    const gpt = await tryCreateClient();
    if (gpt) await gpt.auth.signOut({ scope: "global" }).catch(() => undefined);
    const subs = await createSubsAuthServerClient();
    if (subs) await subs.auth.signOut({ scope: "global" }).catch(() => undefined);
    clearAllSiteUiLogouts(response);
  } else {
    // Выход с текущего магазина: сбрасываем Supabase-сессию этого проекта + UI-флаг.
    if (site === "subs-store") {
      const subs = await createSubsAuthServerClient();
      if (subs) await subs.auth.signOut({ scope: "local" }).catch(() => undefined);
    } else {
      const gpt = await tryCreateClient();
      if (gpt) await gpt.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
    applySiteUiLogoutFromRequest(request, response);
  }

  response.cookies.set("current_site", site, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
    httpOnly: false,
  });

  return response;
}
