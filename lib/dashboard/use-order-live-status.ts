"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { coerceOrderStatus } from "@/lib/dashboard/order-status-tracker";

const API_POLL_MS = 3000;

export type OrderLiveStatusState = {
  status: string;
  paidLike: boolean;
  paidAt: string | null;
};

/**
 * Живой статус заказа: API poll (3s) + Realtime триггерит повторный poll.
 */
export function useOrderLiveStatus(
  orderId: string,
  siteSlug: SiteSlug,
  initialStatus: string | null | undefined,
): OrderLiveStatusState {
  const initial = coerceOrderStatus(initialStatus);
  const [state, setState] = useState<OrderLiveStatusState>(() => ({
    status: initial,
    paidLike: !["pending", "awaiting_payment", "new", "pending_payment_setup"].includes(initial),
    paidAt: null,
  }));

  useEffect(() => {
    const next = coerceOrderStatus(initialStatus);
    setState((prev) => ({
      ...prev,
      status: next,
    }));
  }, [initialStatus, orderId]);

  useEffect(() => {
    let cancelled = false;

    const pollApi = async () => {
      try {
        const res = await fetch(
          `/api/dashboard/order-status?orderId=${encodeURIComponent(orderId)}&site=${encodeURIComponent(siteSlug)}`,
          { credentials: "include", cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          effectiveStatus?: string;
          paidLike?: boolean;
          paid_at?: string | null;
        };
        if (data.effectiveStatus) {
          setState({
            status: coerceOrderStatus(data.effectiveStatus),
            paidLike: Boolean(data.paidLike),
            paidAt: data.paid_at ?? null,
          });
        }
      } catch {
        /* retry on next tick */
      }
    };

    void pollApi();
    const apiTimer = window.setInterval(() => void pollApi(), API_POLL_MS);

    const supabase = siteSlug === "subs-store" ? tryCreateSubsBrowserClient() : createClient();
    if (!supabase) {
      return () => {
        cancelled = true;
        window.clearInterval(apiTimer);
      };
    }

    const channel = supabase
      .channel(`order-live-${siteSlug}-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        () => {
          void pollApi();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(apiTimer);
      void supabase.removeChannel(channel);
    };
  }, [orderId, siteSlug]);

  return state;
}
