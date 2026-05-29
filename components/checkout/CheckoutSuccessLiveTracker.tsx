"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { OrderStatusTracker } from "@/components/ui/OrderStatusTracker";
import { useOrderLiveStatus } from "@/lib/dashboard/use-order-live-status";
import { isOrderAwaitingPayment } from "@/lib/dashboard/customer-order-view";
import { isPaidLikeStatus } from "@/lib/orders/paid-like-status";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

type Props = {
  orderId: string;
  siteSlug: SiteSlug;
  initialStatus: string;
  planId?: string;
  activatedAt?: string | null;
  variant?: "light" | "subs";
  dashboardHref: string;
};

export function CheckoutSuccessLiveTracker({
  orderId,
  siteSlug,
  initialStatus,
  planId,
  activatedAt,
  variant = "light",
  dashboardHref,
}: Props) {
  const liveStatus = useOrderLiveStatus(orderId, siteSlug, initialStatus);
  const [confirming, setConfirming] = useState(false);
  const [confirmNote, setConfirmNote] = useState<string | null>(null);

  const paidLike = isPaidLikeStatus(liveStatus, siteSlug);
  const awaitingPay = isOrderAwaitingPayment(liveStatus);

  useEffect(() => {
    if (paidLike) return;

    let cancelled = false;
    const run = async () => {
      setConfirming(true);
      try {
        const res = await fetch("/api/payments/pally/confirm", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, site: siteSlug }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          applied?: boolean;
          reason?: string;
        };
        if (!cancelled && data.applied) {
          setConfirmNote("Оплата подтверждена — статус обновлён.");
        }
      } catch {
        /* webhook may still arrive */
      } finally {
        if (!cancelled) setConfirming(false);
      }
    };

    const t1 = window.setTimeout(() => void run(), 2500);
    const t2 = window.setInterval(() => void run(), 15000);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearInterval(t2);
    };
  }, [orderId, siteSlug, paidLike]);

  return (
    <div className="space-y-4">
      <OrderStatusTracker
        orderId={orderId}
        initialStatus={liveStatus}
        siteSlug={siteSlug}
        planId={planId}
        activatedAt={activatedAt}
        variant={variant}
      />

      {awaitingPay ? (
        <p className="text-center text-sm text-gray-500">
          {confirming
            ? "Проверяем оплату…"
            : "Если вы уже оплатили, статус обновится через несколько секунд."}
        </p>
      ) : null}

      {confirmNote ? (
        <p className="text-center text-sm font-medium text-[#1DB954]">{confirmNote}</p>
      ) : null}

      {paidLike ? (
        <Link
          href={`${dashboardHref}${dashboardHref.includes("?") ? "&" : "?"}order_id=${encodeURIComponent(orderId)}`}
          className={`block text-center text-sm font-semibold ${variant === "subs" ? "text-[#1DB954]" : "text-[#10a37f]"} hover:underline`}
        >
          Открыть заказ в личном кабинете →
        </Link>
      ) : (
        <Link href={dashboardHref} className="block text-center text-sm text-gray-500 hover:text-gray-800">
          Личный кабинет →
        </Link>
      )}
    </div>
  );
}
