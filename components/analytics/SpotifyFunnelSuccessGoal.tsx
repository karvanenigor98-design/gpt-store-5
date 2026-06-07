"use client";

import { useEffect, useRef } from "react";

import { reachSpotifyFunnelGoal } from "@/lib/analytics/spotify-funnel-goals";

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
    reachSpotifyFunnelGoal("spotify_payment_success", {
      orderId: orderId ?? undefined,
      source: "checkout_success",
    });
  }, [siteSlug, orderId]);

  return null;
}
