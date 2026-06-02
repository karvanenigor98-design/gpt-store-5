import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { User } from "@supabase/supabase-js";

import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { createClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import {
  buildCheckoutPath,
  saveCheckoutIntent,
  type CheckoutIntent,
} from "@/lib/checkout/checkout-intent";

export type CheckoutSessionState = {
  user: User | null;
  emailConfirmed: boolean;
};

export function buildCheckoutAuthUrl(siteSlug: AuthSiteSlug, returnPath: string): string {
  const fallback = siteSlug === "subs-store" ? "/checkout/spotify" : "/checkout";
  const safeReturn =
    returnPath.startsWith("/") && !returnPath.startsWith("//") ? returnPath : fallback;
  const params = new URLSearchParams({
    returnUrl: safeReturn,
    site: siteSlug,
  });
  return `/login?${params.toString()}`;
}

export async function getCheckoutSessionUser(siteSlug: AuthSiteSlug): Promise<CheckoutSessionState> {
  try {
    if (siteSlug === "subs-store") {
      const subs = tryCreateSubsBrowserClient();
      if (!subs) return { user: null, emailConfirmed: false };
      const { data } = await subs.auth.getUser();
      return {
        user: data.user ?? null,
        emailConfirmed: Boolean(data.user?.email_confirmed_at),
      };
    }

    const gpt = createClient();
    const { data } = await gpt.auth.getUser();
    return {
      user: data.user ?? null,
      emailConfirmed: Boolean(data.user?.email_confirmed_at),
    };
  } catch {
    return { user: null, emailConfirmed: false };
  }
}

export function persistCheckoutIntent(params: {
  siteSlug: AuthSiteSlug;
  planId: string;
  planName?: string | null;
  promoCode?: string | null;
  accountEmail?: string | null;
}): CheckoutIntent {
  const returnPath = buildCheckoutPath(params.siteSlug, params.planId);
  const intent: Omit<CheckoutIntent, "createdAt"> = {
    siteSlug: params.siteSlug,
    planId: params.planId,
    planName: params.planName ?? null,
    promoCode: params.promoCode ?? null,
    accountEmail: params.accountEmail ?? null,
    returnPath,
  };
  saveCheckoutIntent(intent);
  return { ...intent, createdAt: Date.now() };
}

export async function navigateToCheckoutOrAuth(params: {
  siteSlug: AuthSiteSlug;
  planId: string;
  planName?: string | null;
  promoCode?: string | null;
  router: AppRouterInstance;
}): Promise<void> {
  const { siteSlug, planId, planName, promoCode, router } = params;
  const returnPath = buildCheckoutPath(siteSlug, planId);
  persistCheckoutIntent({ siteSlug, planId, planName, promoCode });

  const { user, emailConfirmed } = await getCheckoutSessionUser(siteSlug);

  if (user && emailConfirmed) {
    router.push(returnPath);
    return;
  }

  if (user && !emailConfirmed) {
    const verifyParams = new URLSearchParams({
      email: user.email ?? "",
      flow: "checkout",
    });
    verifyParams.set("site", siteSlug);
    verifyParams.set("returnUrl", returnPath);
    router.push(`/verify-email?${verifyParams.toString()}`);
    return;
  }

  router.push(buildCheckoutAuthUrl(siteSlug, returnPath));
}
