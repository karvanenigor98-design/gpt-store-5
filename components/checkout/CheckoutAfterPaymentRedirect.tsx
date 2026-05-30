"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import {
  buildCustomerOrderFocusHref,
  buildCustomerOrdersListHref,
} from "@/lib/dashboard/customer-order-view";

const POLL_MS = 1500;
const MAX_ATTEMPTS = 5;
const FALLBACK_WAIT_MS = 12_000;

type Props = {
  orderId: string;
  siteSlug: SiteSlug;
};

/** После return URL Pally: подтверждаем оплату и сразу в кабинет → заказы. */
export function CheckoutAfterPaymentRedirect({ orderId, siteSlug }: Props) {
  const router = useRouter();
  const isSubs = siteSlug === "subs-store";
  const accent = isSubs ? "#1DB954" : "#10a37f";
  const orderHref = buildCustomerOrderFocusHref(siteSlug, orderId);
  const listHref = buildCustomerOrdersListHref(siteSlug);
  const redirectedRef = useRef(false);
  const [message, setMessage] = useState("Подтверждаем оплату…");

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    let attempts = 0;

    const goCabinet = (href: string, note: string) => {
      if (redirectedRef.current || cancelled) return;
      redirectedRef.current = true;
      setMessage(note);
      router.replace(href);
    };

    const tick = async () => {
      if (redirectedRef.current || cancelled) return;
      attempts += 1;

      try {
        const res = await fetch("/api/payments/checkout-status", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, site: siteSlug }),
        });
        const data = (await res.json().catch(() => ({}))) as { paidLike?: boolean };
        if (data.paidLike) {
          goCabinet(orderHref, "Оплата получена. Переходим в кабинет…");
          return;
        }
      } catch {
        /* retry */
      }

      if (attempts >= MAX_ATTEMPTS || Date.now() - started >= FALLBACK_WAIT_MS) {
        goCabinet(listHref, "Переходим в кабинет…");
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [orderId, siteSlug, orderHref, listHref, router]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <Loader2 size={32} className="animate-spin" style={{ color: accent }} />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}
