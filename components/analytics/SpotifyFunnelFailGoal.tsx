"use client";

import { useEffect, useRef } from "react";

import { reachSpotifyFunnelGoal } from "@/lib/analytics/spotify-funnel-goals";

type Props = {
  siteSlug: "gpt-store" | "subs-store";
};

/** Неудачная оплата Spotify — reachGoal на /checkout/fail?site=subs-store. */
export function SpotifyFunnelFailGoal({ siteSlug }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (siteSlug !== "subs-store" || fired.current) return;
    fired.current = true;
    reachSpotifyFunnelGoal("spotify_payment_fail", { source: "checkout_fail" });
  }, [siteSlug]);

  return null;
}
