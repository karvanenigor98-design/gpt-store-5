import { cookies } from "next/headers";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { isSiteUiLoggedOut } from "@/lib/auth/siteUiSession";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import { isSubsPublicAuthConfigured } from "@/lib/supabase/subs-auth-env";
import { tryCreateClient } from "@/lib/supabase/server";

export type LandingNavSession = {
  loggedIn: boolean;
  emailConfirmed: boolean;
};

/** Сессия для кнопки «Войти» / «Кабинет» — только server/API (httpOnly cookies). */
export async function getLandingNavSession(siteSlug: SiteSlug): Promise<LandingNavSession> {
  const cookieStore = await cookies();
  if (isSiteUiLoggedOut(siteSlug, cookieStore)) {
    return { loggedIn: false, emailConfirmed: false };
  }

  if (siteSlug === "subs-store") {
    if (!isSubsPublicAuthConfigured()) {
      return { loggedIn: false, emailConfirmed: false };
    }
    const subs = await createSubsAuthServerClient();
    if (!subs) return { loggedIn: false, emailConfirmed: false };
    const {
      data: { user },
    } = await subs.auth.getUser();
    return {
      loggedIn: Boolean(user),
      emailConfirmed: Boolean(user?.email_confirmed_at),
    };
  }

  const gpt = await tryCreateClient();
  if (!gpt) return { loggedIn: false, emailConfirmed: false };
  const {
    data: { user },
  } = await gpt.auth.getUser();
  return {
    loggedIn: Boolean(user),
    emailConfirmed: Boolean(user?.email_confirmed_at),
  };
}
