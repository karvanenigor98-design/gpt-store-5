"use client";

import { useEffect, useRef } from "react";

import { trackSpotifyPaymentSuccess } from "@/lib/metrics";

type Props = {
  siteSlug: "gpt-store" | "subs-store";
  orderId?: string | null;
};

/** Успешная оплата Spotify — reachGoal на /checkout/success?site=subs-store. */
export function SpotifyFunnelSuccessGoal({ siteSlug, orderId }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (siteSlug !== "subs-store" || fired.current) return;
    fired.current = true;
    trackSpotifyPaymentSuccess(orderId, "checkout_success");
  }, [siteSlug, orderId]);

  return null;
}
