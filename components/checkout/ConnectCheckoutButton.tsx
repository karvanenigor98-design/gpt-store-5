"use client";

import { useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { buildCheckoutPath } from "@/lib/checkout/checkout-intent";
import { navigateToCheckoutOrAuth } from "@/lib/checkout/checkout-auth";

type ConnectCheckoutButtonProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> & {
  siteSlug: AuthSiteSlug;
  planId: string;
  planName?: string | null;
  promoCode?: string | null;
  children: ReactNode;
};

export function ConnectCheckoutButton({
  siteSlug,
  planId,
  planName,
  promoCode,
  children,
  ...anchorProps
}: ConnectCheckoutButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const checkoutPath = buildCheckoutPath(siteSlug, planId);

  async function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await navigateToCheckoutOrAuth({
        siteSlug,
        planId,
        planName,
        promoCode,
        router,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <a
      href={checkoutPath}
      onClick={(event) => void handleClick(event)}
      aria-busy={busy}
      {...anchorProps}
    >
      {children}
    </a>
  );
}
