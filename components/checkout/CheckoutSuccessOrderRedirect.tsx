"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { buildCustomerOrdersListHref } from "@/lib/dashboard/customer-order-view";
import { isSpotifyStoreHostname } from "@/lib/site-url";

function readOrderIdFromSearch(searchParams: URLSearchParams): string | null {
  const keys = [
    "order",
    "orderId",
    "order_id",
    "orderid",
    "InvId",
    "inv_id",
    "invoice_id",
    "bill_id",
  ];
  for (const key of keys) {
    const value = searchParams.get(key)?.trim();
    if (value) return value;
  }
  return null;
}

/** Pally success без order в URL: sessionStorage / cookie уже на сервере; иначе → кабинет (success = оплачено). */
export function CheckoutSuccessOrderRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);

  const siteParam = searchParams.get("site");
  const siteSlug: SiteSlug =
    siteParam === "subs-store"
      ? "subs-store"
      : siteParam === "gpt-store"
        ? "gpt-store"
        : typeof window !== "undefined" && isSpotifyStoreHostname(window.location.hostname)
          ? "subs-store"
          : "gpt-store";
  const ordersHref = buildCustomerOrdersListHref(siteSlug);
  const isSubs = siteSlug === "subs-store";
  const accent = isSubs ? "#1DB954" : "#10a37f";

  useEffect(() => {
    if (handledRef.current) return;

    const fromQuery = readOrderIdFromSearch(searchParams);
    if (fromQuery) {
      handledRef.current = true;
      const q = new URLSearchParams({ order: fromQuery });
      if (siteParam) q.set("site", siteParam);
      router.replace(`/checkout/success?${q.toString()}`);
      return;
    }

    try {
      const stored =
        (siteSlug === "subs-store"
          ? sessionStorage.getItem("subs-checkout-order")
          : sessionStorage.getItem("gpt-checkout-order")) ??
        sessionStorage.getItem("subs-checkout-order") ??
        sessionStorage.getItem("gpt-checkout-order");

      if (stored) {
        handledRef.current = true;
        const q = new URLSearchParams({ order: stored });
        if (siteSlug === "subs-store") q.set("site", "subs-store");
        router.replace(`/checkout/success?${q.toString()}`);
        return;
      }
    } catch {
      // storage blocked
    }

    // Pally ведёт на success только после успешной оплаты — в кабинет без orderId.
    const t = window.setTimeout(() => {
      if (handledRef.current) return;
      handledRef.current = true;
      router.replace(ordersHref);
    }, 800);

    return () => window.clearTimeout(t);
  }, [router, searchParams, siteParam, ordersHref]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <Loader2 size={32} className="animate-spin" style={{ color: accent }} />
      <p className="text-sm text-gray-600">Оплата прошла. Переходим в личный кабинет…</p>
    </div>
  );
}
