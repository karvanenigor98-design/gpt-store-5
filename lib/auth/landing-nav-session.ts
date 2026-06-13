import { cookies } from "next/headers";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { isSiteUiLoggedOut } from "@/lib/auth/siteUiSession";
import { withTimeout } from "@/lib/server/withTimeout";
import { createSubsAuthServerClient } from "@/lib/supabase/subs-auth-server";
import { isSubsPublicAuthConfigured } from "@/lib/supabase/subs-auth-env";
import { tryCreateClient } from "@/lib/supabase/server";

export type LandingNavSession = {
  loggedIn: boolean;
  emailConfirmed: boolean;
};

const LANDING_SESSION_FALLBACK: LandingNavSession = {
  loggedIn: false,
  emailConfirmed: false,
};

async function getLandingNavSessionInner(siteSlug: SiteSlug): Promise<LandingNavSession> {
  const cookieStore = await cookies();
  if (isSiteUiLoggedOut(siteSlug, cookieStore)) {
    return LANDING_SESSION_FALLBACK;
  }

  if (siteSlug === "subs-store") {
    if (!isSubsPublicAuthConfigured()) {
      return LANDING_SESSION_FALLBACK;
    }
    const subs = await createSubsAuthServerClient();
    if (!subs) return LANDING_SESSION_FALLBACK;
    const {
      data: { user },
    } = await subs.auth.getUser();
    return {
      loggedIn: Boolean(user),
      emailConfirmed: Boolean(user?.email_confirmed_at),
    };
  }

  const gpt = await tryCreateClient();
  if (!gpt) return LANDING_SESSION_FALLBACK;
  const {
    data: { user },
  } = await gpt.auth.getUser();
  return {
    loggedIn: Boolean(user),
    emailConfirmed: Boolean(user?.email_confirmed_at),
  };
}

/** Сессия для кнопки «Войти» / «Кабинет» — только server/API (httpOnly cookies). */
export async function getLandingNavSession(siteSlug: SiteSlug): Promise<LandingNavSession> {
  return withTimeout(getLandingNavSessionInner(siteSlug), 2000, LANDING_SESSION_FALLBACK);
}
