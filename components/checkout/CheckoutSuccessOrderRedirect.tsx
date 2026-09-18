"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { buildCustomerOrdersListHref } from "@/lib/dashboard/customer-order-view";
import { isSpotifyStoreHostname } from "@/lib/site-url";
import { GptPayerEmailRecover } from "@/components/checkout/GptPayerEmailRecover";

function readOrderIdFromSearch(searchParams: URLSearchParams): string | null {
  const keys = [
    "order",
    "orderId",
    "order_id",
    "orderid",
    "InvId",
    "inv_id",
    "invid",
    "invoice_id",
    "bill_id",
    "payment_id",
    "PaymentId",
    "TrsId",
  ];
  for (const key of keys) {
    const value = searchParams.get(key)?.trim();
    if (value) return value;
  }
  for (const value of searchParams.values()) {
    const v = value.trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
      return v;
    }
  }
  return null;
}

/** Pally success без cookie (QR с телефона): не кидать на /login через кабинет. */
export function CheckoutSuccessOrderRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);
  const [recover, setRecover] = useState(false);

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

    const t = window.setTimeout(() => {
      if (handledRef.current) return;
      handledRef.current = true;
      if (siteSlug === "gpt-store") {
        setRecover(true);
        return;
      }
      router.replace(ordersHref);
    }, 800);

    return () => window.clearTimeout(t);
  }, [router, searchParams, siteParam, ordersHref, siteSlug]);

  if (recover) {
    return <GptPayerEmailRecover />;
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <Loader2 size={32} className="animate-spin" style={{ color: accent }} />
      <p className="text-sm text-gray-600">Оплата прошла. Открываем чат…</p>
    </div>
  );
}
