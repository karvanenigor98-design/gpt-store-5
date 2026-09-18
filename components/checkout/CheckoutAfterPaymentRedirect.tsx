"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { trackGPTPaymentSuccessWhenReady, trackSpotifyPaymentSuccessWhenReady } from "@/lib/metrics";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { createClient } from "@/lib/supabase/client";
import { GptPayerEmailRecover } from "@/components/checkout/GptPayerEmailRecover";
import {
  buildCustomerOrderFocusHref,
  buildCustomerOrdersListHref,
} from "@/lib/dashboard/customer-order-view";

const POLL_MS = 1500;
const MAX_ATTEMPTS = 8;
const FALLBACK_WAIT_MS = 18_000;

type Props = {
  orderId: string;
  siteSlug: SiteSlug;
};

const CHAT_HREF = "/dashboard/chat?site=gpt-store";

async function claimGptGuestSession(orderId: string): Promise<string | null> {
  const res = await fetch("/api/checkout/gpt/claim-session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    pending?: boolean;
    redirectTo?: string;
  };
  if (json.ok && json.redirectTo) return json.redirectTo;
  return null;
}

/** После return URL Pally: подтверждаем оплату и сразу в кабинет → заказы. */
export function CheckoutAfterPaymentRedirect({ orderId, siteSlug }: Props) {
  const router = useRouter();
  const isSubs = siteSlug === "subs-store";
  const accent = isSubs ? "#1DB954" : "#10a37f";
  const orderHref = buildCustomerOrderFocusHref(siteSlug, orderId);
  const listHref = buildCustomerOrdersListHref(siteSlug);
  const redirectedRef = useRef(false);
  const paymentSuccessGoalFired = useRef(false);
  const [message, setMessage] = useState("Подтверждаем оплату…");
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    let attempts = 0;

    const go = (href: string, note: string) => {
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
          if (!paymentSuccessGoalFired.current) {
            paymentSuccessGoalFired.current = true;
            if (siteSlug === "subs-store") {
              trackSpotifyPaymentSuccessWhenReady(orderId, "checkout_status_paid");
            } else {
              trackGPTPaymentSuccessWhenReady(orderId, "checkout_status_paid");
            }
          }
          if (siteSlug === "gpt-store") {
            const claimed = await claimGptGuestSession(orderId);
            if (claimed) {
              go(claimed, "Оплата прошла. Открываем чат…");
              return;
            }
            const { data: sessionData } = await createClient().auth.getUser();
            if (sessionData.user) {
              go(CHAT_HREF, "Оплата прошла. Открываем чат…");
              return;
            }
          } else {
            go(orderHref, "Оплата получена. Переходим в кабинет…");
            return;
          }
        }
      } catch {
        /* retry */
      }

      if (attempts >= MAX_ATTEMPTS || Date.now() - started >= FALLBACK_WAIT_MS) {
        if (siteSlug === "gpt-store") {
          const claimed = await claimGptGuestSession(orderId).catch(() => null);
          if (claimed) {
            go(claimed, "Открываем чат…");
            return;
          }
          const { data: sessionData } = await createClient().auth.getUser();
          if (sessionData.user) {
            go(CHAT_HREF, "Открываем чат…");
            return;
          }
          if (redirectedRef.current || cancelled) return;
          redirectedRef.current = true;
          setStuck(true);
          setMessage("Платёж ещё подтверждается");
          return;
        }
        go(listHref, "Переходим в кабинет…");
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [orderId, siteSlug, orderHref, listHref, router]);

  if (stuck) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <p className="text-lg font-semibold text-gray-900">{message}</p>
        <p className="text-sm text-gray-600">
          Если платили с другого устройства — откройте чат по email заказа.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#10a37f] px-4 text-sm font-semibold text-white"
        >
          Обновить
        </button>
        <GptPayerEmailRecover title="Или войдите по email" />
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <Loader2 size={32} className="animate-spin" style={{ color: accent }} />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  );
}
