"use client";

import { useEffect } from "react";

import { trackGPTPaymentSuccessWhenReady } from "@/lib/metrics";

type Props = {
  siteSlug: "gpt-store" | "subs-store";
  orderId?: string | null;
};

/** Успешная оплата GPT — reachGoal на /checkout/success (не Subs). */
export function GptFunnelSuccessGoal({ siteSlug, orderId }: Props) {
  useEffect(() => {
    if (siteSlug !== "gpt-store") return;
    trackGPTPaymentSuccessWhenReady(orderId, "checkout_success");
  }, [siteSlug, orderId]);

  return null;
}
