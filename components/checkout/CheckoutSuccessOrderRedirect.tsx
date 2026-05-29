"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** После Pally success_url без query — подставляем order из sessionStorage. */
export function CheckoutSuccessOrderRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (
      searchParams.get("order") ||
      searchParams.get("orderId") ||
      searchParams.get("order_id")
    ) {
      return;
    }

    try {
      const site = searchParams.get("site");
      const stored =
        (site === "subs-store"
          ? sessionStorage.getItem("subs-checkout-order")
          : null) ??
        sessionStorage.getItem("gpt-checkout-order") ??
        sessionStorage.getItem("subs-checkout-order");

      if (!stored) return;

      const q = new URLSearchParams({ order: stored });
      if (site) q.set("site", site);
      router.replace(`/checkout/success?${q.toString()}`);
      sessionStorage.removeItem("gpt-checkout-order");
      sessionStorage.removeItem("subs-checkout-order");
    } catch {
      // storage blocked
    }
  }, [router, searchParams]);

  return null;
}
