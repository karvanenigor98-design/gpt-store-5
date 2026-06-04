"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { getCheckoutSessionUser, persistCheckoutIntent } from "@/lib/checkout/checkout-auth";
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

      const resolvedPlanId = planId ?? parsePlanIdFromCheckoutPath(returnPath ?? "");
      const checkoutIntent =
        intent ??
        (resolvedPlanId
          ? {
              siteSlug,
              planId: resolvedPlanId,
              returnPath:
                returnPath ??
                (siteSlug === "subs-store"
                  ? `/checkout/spotify?plan=${encodeURIComponent(resolvedPlanId)}`
                  : `/checkout?plan=${encodeURIComponent(resolvedPlanId)}`),
              createdAt: Date.now(),
            }
          : null);

      /** Гость может пройти выбор тарифа и email; вход — перед оплатой. */
      if (!user) {
        setState({
          ready: true,
          authenticated: false,
          emailConfirmed: false,
          intent: checkoutIntent,
        });
        return;
      }

      if (!emailConfirmed) {
        redirectedRef.current = true;
        const verifyParams = new URLSearchParams({
          email: user.email ?? "",
          flow: "checkout",
        });
        verifyParams.set("site", siteSlug);
        const verifyReturn =
          returnPath ??
          (resolvedPlanId
            ? siteSlug === "subs-store"
              ? `/checkout/spotify?plan=${encodeURIComponent(resolvedPlanId)}`
              : `/checkout?plan=${encodeURIComponent(resolvedPlanId)}`
            : getCheckoutPlanStepPath(siteSlug));
        verifyParams.set("returnUrl", verifyReturn);
        router.replace(`/verify-email?${verifyParams.toString()}`);
        return;
      }

      if (!resolvedPlanId && !checkoutIntent) {
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
        intent: checkoutIntent,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [siteSlug, planFromUrl, router]);

  return state;
}
