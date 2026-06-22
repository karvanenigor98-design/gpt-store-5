"use client";

import { useEffect } from "react";

import { trackSpotifyPaymentFailWhenReady } from "@/lib/metrics";

type Props = {
  siteSlug: "gpt-store" | "subs-store";
};

/** Неудачная оплата Spotify — reachGoal на /checkout/fail?site=subs-store. */
export function SpotifyFunnelFailGoal({ siteSlug }: Props) {
  useEffect(() => {
    if (siteSlug !== "subs-store") return;
    trackSpotifyPaymentFailWhenReady("checkout_fail");
  }, [siteSlug]);

  return null;
}
