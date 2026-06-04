"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import {
  buildCheckoutAuthUrl,
  getCheckoutSessionUser,
  persistCheckoutIntent,
} from "@/lib/checkout/checkout-auth";
import {
  clearCheckoutIntent,
  parsePlanIdFromCheckoutPath,
  readCheckoutIntent,
  type CheckoutIntent,
} from "@/lib/checkout/checkout-intent";
import { getCheckoutPlanStepPath } from "@/lib/checkout/checkout-navigation";

export type CheckoutAuthGateState = {
  ready: boolean;
  authenticated: boolean;
  emailConfirmed: boolean;
  intent: CheckoutIntent | null;
};

export function useCheckoutAuthGate(siteSlug: AuthSiteSlug): CheckoutAuthGateState {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planFromUrl = searchParams.get("plan");
  const redirectedRef = useRef(false);

  const [state, setState] = useState<CheckoutAuthGateState>({
    ready: false,
    authenticated: false,
    emailConfirmed: false,
    intent: null,
  });

  useEffect(() => {
    if (redirectedRef.current) return;

    let cancelled = false;

    void (async () => {
      const stored = readCheckoutIntent(siteSlug);
      /** Только ?plan= в URL — не подтягиваем старый intent при общей кнопке «Подключить». */
      const planId = planFromUrl ?? null;

      if (planId) {
        persistCheckoutIntent({
          siteSlug,
          planId,
          planName: stored?.planName,
          promoCode: stored?.promoCode,
          accountEmail: stored?.accountEmail,
        });
      } else if (!planFromUrl && stored?.planId) {
        clearCheckoutIntent();
      }

      const intent = readCheckoutIntent(siteSlug);
      const returnPath =
        intent?.returnPath ??
        (planId ? (siteSlug === "subs-store" ? `/checkout/spotify?plan=${planId}` : `/checkout?plan=${planId}`) : null);

      const { user, emailConfirmed } = await getCheckoutSessionUser(siteSlug);
      if (cancelled) return;

      if (!user) {
        redirectedRef.current = true;
        if (planId && returnPath) {
          persistCheckoutIntent({
            siteSlug,
            planId,
            planName: intent?.planName,
            promoCode: intent?.promoCode,
            accountEmail: intent?.accountEmail,
          });
        }
        const fallbackReturn = returnPath ?? getCheckoutPlanStepPath(siteSlug);
        router.replace(buildCheckoutAuthUrl(siteSlug, fallbackReturn));
        return;
      }

      if (!emailConfirmed) {
        redirectedRef.current = true;
        const verifyParams = new URLSearchParams({
          email: user.email ?? "",
          flow: "checkout",
        });
        verifyParams.set("site", siteSlug);
        if (returnPath) verifyParams.set("returnUrl", returnPath);
        router.replace(`/verify-email?${verifyParams.toString()}`);
        return;
      }

      const resolvedPlanId = planId ?? parsePlanIdFromCheckoutPath(returnPath ?? "");
      if (!resolvedPlanId && !intent) {
        setState({
          ready: true,
          authenticated: true,
          emailConfirmed: true,
          intent: null,
        });
        return;
      }

      setState({
        ready: true,
        authenticated: true,
        emailConfirmed: true,
        intent: intent ?? (resolvedPlanId && returnPath
          ? {
              siteSlug,
              planId: resolvedPlanId,
              returnPath,
              createdAt: Date.now(),
            }
          : null),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [siteSlug, planFromUrl, router]);

  return state;
}
