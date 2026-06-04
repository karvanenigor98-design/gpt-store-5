"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import {
  getCheckoutEmailStepPath,
  getCheckoutPlanStepPath,
  goToCheckoutEmailStep,
  goToCheckoutPlanStep,
} from "@/lib/checkout/checkout-navigation";
import { cn } from "@/lib/utils";

type CheckoutNavButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type"> & {
  siteSlug: AuthSiteSlug;
  planId?: string | null;
  planName?: string | null;
  promoCode?: string | null;
  children: ReactNode;
};

/** Кнопка checkout: без planId → выбор тарифа; с planId → email. */
export function CheckoutNavButton({
  siteSlug,
  planId,
  planName,
  promoCode,
  children,
  className,
  disabled,
  ...rest
}: CheckoutNavButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const href = planId
    ? getCheckoutEmailStepPath(siteSlug, planId)
    : getCheckoutPlanStepPath(siteSlug);

  async function handleClick() {
    if (busy || disabled) return;
    setBusy(true);
    try {
      if (planId) {
        await goToCheckoutEmailStep({
          siteSlug,
          planId,
          planName,
          promoCode,
          router,
        });
      } else {
        await goToCheckoutPlanStep({ siteSlug, router });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={disabled || busy}
      aria-busy={busy}
      className={cn(className, busy && "opacity-80")}
      {...rest}
    >
      {children}
    </button>
  );
}
