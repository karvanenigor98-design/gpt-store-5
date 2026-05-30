"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { buildCustomerOrderFocusHref } from "@/lib/dashboard/customer-order-view";
import { CHECKOUT_PAYMENT_URL_STORAGE_KEY } from "@/lib/checkout/start-payment-wait";
import { cn } from "@/lib/utils";

const POLL_MS = 3000;

type Props = {
  orderId: string;
  siteSlug: SiteSlug;
};

export function CheckoutPaymentWait({ orderId, siteSlug }: Props) {
  const router = useRouter();
  const isSubs = siteSlug === "subs-store";
  const accent = isSubs ? "#1DB954" : "#10a37f";
  const dashboardHref = buildCustomerOrderFocusHref(siteSlug, orderId);
  const ordersHref = isSubs ? "/dashboard/orders?site=subs-store" : "/dashboard/orders?site=gpt-store";

  const [checking, setChecking] = useState(true);
  const [paidLike, setPaidLike] = useState(false);
  const [paymentTabOpened, setPaymentTabOpened] = useState(false);
  const [reopenHint, setReopenHint] = useState(false);
  const openedRef = useRef(false);
  const paymentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    try {
      const url = sessionStorage.getItem(CHECKOUT_PAYMENT_URL_STORAGE_KEY);
      if (url) {
        paymentUrlRef.current = url;
        const win = window.open(url, "_blank", "noopener,noreferrer");
        setPaymentTabOpened(Boolean(win));
        if (!win) setReopenHint(true);
      }
    } catch {
      setReopenHint(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch("/api/payments/checkout-status", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, site: siteSlug }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          paidLike?: boolean;
          status?: string;
        };
        if (cancelled) return;
        if (data.paidLike) {
          setPaidLike(true);
          setChecking(false);
          try {
            sessionStorage.removeItem(CHECKOUT_PAYMENT_URL_STORAGE_KEY);
          } catch {
            /* ignore */
          }
          window.setTimeout(() => router.replace(dashboardHref), 1200);
        }
      } catch {
        /* retry on next tick */
      } finally {
        if (!cancelled && !paidLike) setChecking(true);
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [orderId, siteSlug, dashboardHref, router, paidLike]);

  function reopenPayment() {
    const url = paymentUrlRef.current;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setReopenHint(true);
  }

  return (
    <div
      className={cn(
        "w-full max-w-lg space-y-6 text-center",
        isSubs && "rounded-2xl border border-white/10 bg-[#111111] px-6 py-8 text-gray-100",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
          isSubs ? "bg-[#1DB954]/15" : "bg-amber-50",
        )}
      >
        {paidLike ? (
          <span className="text-2xl" style={{ color: accent }}>
            ✓
          </span>
        ) : (
          <Loader2 size={28} className="animate-spin" style={{ color: accent }} />
        )}
      </div>

      <div>
        <h1 className={cn("font-heading text-2xl font-bold", isSubs ? "text-white" : "text-gray-900")}>
          {paidLike ? "Оплата получена!" : "Ожидаем оплату"}
        </h1>
        <p className={cn("mt-2 text-sm", isSubs ? "text-gray-400" : "text-gray-500")}>
          {paidLike
            ? "Перенаправляем в личный кабинет…"
            : paymentTabOpened
              ? "Оплатите в открытой вкладке Pally. Можно сканировать QR с телефона — этот экран обновится сам."
              : "Откройте страницу оплаты и завершите платёж. После оплаты с телефона вы автоматически попадёте в кабинет."}
        </p>
      </div>

      {!paidLike ? (
        <div className="space-y-3">
          {reopenHint ? (
            <p className={cn("text-xs", isSubs ? "text-amber-200/90" : "text-amber-700")}>
              Браузер заблокировал новую вкладку — разрешите всплывающие окна или нажмите кнопку ниже.
            </p>
          ) : null}
          <button
            type="button"
            onClick={reopenPayment}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90",
            )}
            style={{ backgroundColor: accent }}
          >
            <ExternalLink size={16} />
            Открыть оплату
          </button>
          {checking ? (
            <p className={cn("text-xs", isSubs ? "text-gray-500" : "text-gray-400")}>
              Проверяем статус оплаты…
            </p>
          ) : null}
        </div>
      ) : null}

      <Link
        href={paidLike ? dashboardHref : ordersHref}
        className={cn(
          "block text-sm font-semibold hover:underline",
          isSubs ? "text-[#1DB954]" : "text-[#10a37f]",
        )}
      >
        {paidLike ? "Перейти к заказу в кабинете →" : "Уже оплатил — открыть кабинет →"}
      </Link>
    </div>
  );
}
