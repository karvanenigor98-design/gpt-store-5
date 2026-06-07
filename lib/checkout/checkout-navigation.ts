import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { scrollToSpotifyPricing } from "@/lib/spotify/scroll-to-pricing";
import { persistCheckoutIntent } from "@/lib/checkout/checkout-auth";
import {
  buildCheckoutPath,
  clearCheckoutIntent,
} from "@/lib/checkout/checkout-intent";

/** Checkout step 1 — выбор тарифа (без предвыбранного plan). */
export function getCheckoutPlanStepPath(siteSlug: AuthSiteSlug): string {
  return siteSlug === "subs-store" ? "/checkout/spotify" : "/checkout";
}

/** Checkout route для выбранного тарифа (открывает оплату с предвыбранным plan). */
export function getCheckoutEmailStepPath(siteSlug: AuthSiteSlug, planId: string): string {
  return buildCheckoutPath(siteSlug, planId);
}

/** Общая CTA на лендинге → блок тарифов. */
export function scrollToPricingForSite(siteSlug: AuthSiteSlug): void {
  if (siteSlug === "subs-store") {
    scrollToSpotifyPricing();
    return;
  }
  const el = document.getElementById("pricing");
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.location.hash = "pricing";
    return;
  }
  window.location.hash = "pricing";
}

async function navigateToCheckoutPath(params: {
  siteSlug: AuthSiteSlug;
  path: string;
  router: AppRouterInstance;
}): Promise<void> {
  const { path, router } = params;
  router.push(path);
}

/** Общая кнопка подключения → шаг выбора тарифа. */
export async function goToCheckoutPlanStep(params: {
  siteSlug: AuthSiteSlug;
  router: AppRouterInstance;
}): Promise<void> {
  clearCheckoutIntent();
  await navigateToCheckoutPath({
    siteSlug: params.siteSlug,
    path: getCheckoutPlanStepPath(params.siteSlug),
    router: params.router,
  });
}

/** Конкретный тариф → checkout выбранного плана (с сохранением intent и auth gate). */
export async function goToCheckoutEmailStep(params: {
  siteSlug: AuthSiteSlug;
  planId: string;
  planName?: string | null;
  promoCode?: string | null;
  router: AppRouterInstance;
}): Promise<void> {
  const { siteSlug, planId, planName, promoCode, router } = params;
  persistCheckoutIntent({ siteSlug, planId, planName, promoCode });
  await navigateToCheckoutPath({
    siteSlug,
    path: buildCheckoutPath(siteSlug, planId),
    router,
  });
}
