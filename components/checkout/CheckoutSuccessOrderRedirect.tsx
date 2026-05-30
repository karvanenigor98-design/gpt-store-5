"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { buildCustomerOrdersListHref } from "@/lib/dashboard/customer-order-view";

const TIMEOUT_MS = 8000;

/** После Pally success_url без query — подставляем order из sessionStorage; таймаут → fallback. */
export function CheckoutSuccessOrderRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [timedOut, setTimedOut] = useState(false);

  const siteParam = searchParams.get("site");
  const siteSlug: SiteSlug = siteParam === "subs-store" ? "subs-store" : "gpt-store";
  const ordersHref = buildCustomerOrdersListHref(siteSlug);
  const loginHref = `/login?site=${siteSlug}&returnUrl=${encodeURIComponent(ordersHref)}`;

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
        (site === "subs-store" ? sessionStorage.getItem("subs-checkout-order") : null) ??
        sessionStorage.getItem("gpt-checkout-order") ??
        sessionStorage.getItem("subs-checkout-order");

      if (stored) {
        const q = new URLSearchParams({ order: stored });
        if (site) q.set("site", site);
        router.replace(`/checkout/success?${q.toString()}`);
        sessionStorage.removeItem("gpt-checkout-order");
        sessionStorage.removeItem("subs-checkout-order");
        return;
      }
    } catch {
      // storage blocked
    }

    const t = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [router, searchParams]);

  if (!timedOut) return null;

  const isSubs = siteSlug === "subs-store";
  const accent = isSubs ? "#1DB954" : "#10a37f";

  return (
    <div className="mx-auto mb-6 w-full max-w-lg rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left">
      <p className="text-sm font-bold text-gray-900">Не удалось автоматически открыть заказ</p>
      <p className="mt-1 text-sm text-gray-600">
        Если вы уже оплатили — откройте личный кабинет: заказ там и статус обновится в течение минуты.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={ordersHref}
          className="inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          Мои заказы
        </Link>
        <Link
          href={loginHref}
          className="inline-flex rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-gray-700"
        >
          Войти в кабинет
        </Link>
        <Link
          href={isSubs ? "/spotify" : "/"}
          className="inline-flex rounded-xl px-4 py-2 text-sm text-gray-500 hover:text-gray-800"
        >
          {isSubs ? "На главную SPOTIFY STORE" : "На главную GPT STORE"}
        </Link>
      </div>
    </div>
  );
}
