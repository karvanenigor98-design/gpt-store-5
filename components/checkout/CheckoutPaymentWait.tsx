"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { redirectToCheckoutPayment } from "@/lib/checkout/resume-checkout-payment";
import { buildCustomerOrderFocusHref } from "@/lib/dashboard/customer-order-view";
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

  const [paidLike, setPaidLike] = useState(false);
  const [redirectFailed, setRedirectFailed] = useState(false);
  const [redirecting, setRedirecting] = useState(true);
  const payAttemptRef = useRef(false);

  useEffect(() => {
    if (payAttemptRef.current) return;
    payAttemptRef.current = true;

    void redirectToCheckoutPayment(orderId, siteSlug).then((ok) => {
      if (!ok) {
        setRedirecting(false);
        setRedirectFailed(true);
      }
    });
  }, [orderId, siteSlug]);

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
        const data = (await res.json().catch(() => ({}))) as { paidLike?: boolean };
        if (cancelled) return;
        if (data.paidLike) {
          setPaidLike(true);
          setRedirecting(false);
          window.setTimeout(() => router.replace(dashboardHref), 800);
        }
      } catch {
        /* retry */
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [orderId, siteSlug, dashboardHref, router]);

  async function retryPayment() {
    setRedirectFailed(false);
    setRedirecting(true);
    const ok = await redirectToCheckoutPayment(orderId, siteSlug);
    if (!ok) {
      setRedirecting(false);
      setRedirectFailed(true);
    }
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
          {paidLike ? "Оплата получена!" : redirecting ? "Переход на оплату…" : "Ожидаем оплату"}
        </h1>
        <p className={cn("mt-2 text-sm", isSubs ? "text-gray-400" : "text-gray-500")}>
          {paidLike
            ? "Перенаправляем в личный кабинет…"
            : redirecting
              ? "Открываем страницу выбора способа оплаты Pally…"
              : "Завершите платёж на стороне Pally. После оплаты вы попадёте в кабинет."}
        </p>
      </div>

      {!paidLike && redirectFailed ? (
        <div className="space-y-3">
          <p className={cn("text-xs", isSubs ? "text-amber-200/90" : "text-amber-700")}>
            Не удалось автоматически открыть оплату. Нажмите кнопку ниже.
          </p>
          <button
            type="button"
            onClick={() => void retryPayment()}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            <ExternalLink size={16} />
            Открыть оплату
          </button>
        </div>
      ) : null}

      {!paidLike && redirecting ? (
        <p className={cn("text-xs", isSubs ? "text-gray-500" : "text-gray-400")}>
          Проверяем статус оплаты…
        </p>
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
