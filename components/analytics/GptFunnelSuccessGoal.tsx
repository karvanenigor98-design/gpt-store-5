"use client";

import { useEffect, useRef } from "react";

import { trackGPTPaymentSuccess } from "@/lib/metrics";

type Props = {
  siteSlug: "gpt-store" | "subs-store";
  orderId?: string | null;
};

/** Успешная оплата GPT — reachGoal на /checkout/success (не Subs). */
export function GptFunnelSuccessGoal({ siteSlug, orderId }: Props) {
  const fired = useRef(false);

  useEffect(() => {
    if (siteSlug !== "gpt-store" || fired.current) return;
    fired.current = true;
    trackGPTPaymentSuccess(orderId, "checkout_success");
  }, [siteSlug, orderId]);

  return null;
}
