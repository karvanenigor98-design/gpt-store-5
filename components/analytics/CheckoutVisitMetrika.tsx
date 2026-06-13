"use client";

import { useEffect, useRef } from "react";

import { trackGPTCheckout, trackSpotifyCheckout } from "@/lib/metrics";

type Props = {
  store: "gpt" | "spotify";
};

/**
 * Цель входа на checkout-страницу.
 * Монтируется на уровне page.tsx — не зависит от auth gate и шагов оплаты.
 */
export function CheckoutVisitMetrika({ store }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (store === "gpt") {
      trackGPTCheckout();
    } else {
      trackSpotifyCheckout();
    }
  }, [store]);

  return null;
}
