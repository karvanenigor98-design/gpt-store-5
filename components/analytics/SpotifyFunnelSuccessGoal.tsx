"use client";

import { useEffect } from "react";

import { trackSpotifyPaymentSuccessWhenReady } from "@/lib/metrics";

type Props = {
  siteSlug: "gpt-store" | "subs-store";
  orderId?: string | null;
};

/** Успешная оплата Spotify — reachGoal на /checkout/success?site=subs-store. */
export function SpotifyFunnelSuccessGoal({ siteSlug, orderId }: Props) {
  useEffect(() => {
    if (siteSlug !== "subs-store") return;
    trackSpotifyPaymentSuccessWhenReady(orderId, "checkout_success");
  }, [siteSlug, orderId]);

  return null;
}
