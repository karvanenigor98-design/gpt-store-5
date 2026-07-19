"use client";

import { useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { trackGptSelectPlan, trackSpotifySelectPlan } from "@/lib/metrics";
import { navigateToCheckoutOrAuth } from "@/lib/checkout/checkout-auth";
import { getCheckoutEmailStepPath } from "@/lib/checkout/checkout-navigation";

type ConnectCheckoutButtonProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> & {
  siteSlug: AuthSiteSlug;
  planId: string;
  planName?: string | null;
  promoCode?: string | null;
  /** Analytics source for select_plan goals (default: landing_pricing). */
  trackSource?: string;
  children: ReactNode;
};

export function ConnectCheckoutButton({
  siteSlug,
  planId,
  planName,
  promoCode,
  trackSource = "landing_pricing",
  children,
  ...anchorProps
}: ConnectCheckoutButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const checkoutPath = getCheckoutEmailStepPath(siteSlug, planId);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (siteSlug === "gpt-store") {
        trackGptSelectPlan(planId, trackSource);
      } else if (siteSlug === "subs-store") {
        trackSpotifySelectPlan(planId, trackSource);
      }
      await navigateToCheckoutOrAuth({
        siteSlug,
        planId,
        planName,
        promoCode,
        router,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <a
      href={checkoutPath}
      onClick={(event) => void handleClick(event)}
      aria-busy={busy}
      {...anchorProps}
    >
      {children}
    </a>
  );
}
