"use client";

import { useEffect, useRef } from "react";

import { trackSpotifyPaymentFail } from "@/lib/metrics";

type Props = {
  siteSlug: "gpt-store" | "subs-store";
};

/** Неудачная оплата Spotify — reachGoal на /checkout/fail?site=subs-store. */
export function SpotifyFunnelFailGoal({ siteSlug }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (siteSlug !== "subs-store" || fired.current) return;
    fired.current = true;
    trackSpotifyPaymentFail("checkout_fail");
  }, [siteSlug]);

  return null;
}
