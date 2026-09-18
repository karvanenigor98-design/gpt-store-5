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
import { readCapturedPromo } from "@/lib/checkout/promo-capture";

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
  const empty: CheckoutSessionState = { user: null, emailConfirmed: false };
  try {
    // Не обрывать сессию слишком рано: иначе checkout думает, что юзер гость,
    // и «Оплатить» уводит на /login (похоже на обновление страницы).
    const result = await Promise.race([
      readCheckoutSessionUser(siteSlug),
      new Promise<CheckoutSessionState>((resolve) => {
        setTimeout(() => resolve(empty), 8000);
      }),
    ]);
    return result;
  } catch {
    return empty;
  }
}

async function readCheckoutSessionUser(siteSlug: AuthSiteSlug): Promise<CheckoutSessionState> {
  try {
    if (siteSlug === "subs-store") {
      const subs = tryCreateSubsBrowserClient();
      if (!subs) return { user: null, emailConfirmed: false };
      // getUser() валидирует сессию; getSession() иногда отдаёт null на холодном старте
      const { data: userData } = await subs.auth.getUser();
      const sessionUser = userData.user ?? null;
      return {
        user: sessionUser,
        emailConfirmed: Boolean(sessionUser?.email_confirmed_at),
      };
    }

    const gpt = createClient();
    const { data: userData } = await gpt.auth.getUser();
    const sessionUser = userData.user ?? null;
    return {
      user: sessionUser,
      emailConfirmed: Boolean(sessionUser?.email_confirmed_at),
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
  const promoCode = params.promoCode?.trim() || readCapturedPromo();
  const returnPath = buildCheckoutPath(params.siteSlug, params.planId, promoCode);
  const intent: Omit<CheckoutIntent, "createdAt"> = {
    siteSlug: params.siteSlug,
    planId: params.planId,
    planName: params.planName ?? null,
    promoCode: promoCode ?? null,
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
  skipAuthGate?: boolean;
}): Promise<void> {
  const { siteSlug, planId, planName, promoCode, router, skipAuthGate } = params;
  persistCheckoutIntent({ siteSlug, planId, planName, promoCode });
  const checkoutPath = buildCheckoutPath(siteSlug, planId, promoCode ?? readCapturedPromo());
  if (siteSlug === "gpt-store" && !skipAuthGate) {
    const { user } = await getCheckoutSessionUser(siteSlug);
    if (!user) {
      router.push(buildCheckoutAuthUrl(siteSlug, checkoutPath));
      return;
    }
  }
  router.push(checkoutPath);
}
