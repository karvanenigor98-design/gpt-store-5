"use client";

import Link from "next/link";

import { CheckoutNavButton } from "@/components/checkout/CheckoutNavButton";
import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";

type Props = {
  siteSlug: AuthSiteSlug;
  accent: string;
  ordersHref: string;
  homeHref: string;
  homeLabel: string;
};

export function CheckoutFailActions({
  siteSlug,
  accent,
  ordersHref,
  homeHref,
  homeLabel,
}: Props) {
  return (
    <div className="space-y-2">
      <CheckoutNavButton
        siteSlug={siteSlug}
        className="block w-full rounded-xl py-3 text-sm font-semibold text-white text-center hover:opacity-90"
        style={{ backgroundColor: accent }}
      >
        Попробовать снова
      </CheckoutNavButton>
      <Link
        href={ordersHref}
        className="block w-full rounded-xl border border-black/[0.1] py-3 text-sm text-gray-600 text-center hover:bg-gray-50"
      >
        Мои заказы
      </Link>
      <Link
        href={homeHref}
        className="block w-full rounded-xl py-3 text-sm text-gray-500 text-center hover:text-gray-800"
      >
        {homeLabel}
      </Link>
    </div>
  );
}
