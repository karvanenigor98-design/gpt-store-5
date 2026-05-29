"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { coerceOrderStatus } from "@/lib/dashboard/order-status-tracker";

const POLL_MS = 15_000;

/**
 * Живой статус заказа в кабинете клиента: Supabase Realtime + редкий poll (если realtime выключен в БД).
 */
export function useOrderLiveStatus(
  orderId: string,
  siteSlug: SiteSlug,
  initialStatus: string | null | undefined,
): string {
  const [status, setStatus] = useState(() => coerceOrderStatus(initialStatus));

  useEffect(() => {
    setStatus(coerceOrderStatus(initialStatus));
  }, [initialStatus, orderId]);

  useEffect(() => {
    const supabase = siteSlug === "subs-store" ? tryCreateSubsBrowserClient() : createClient();
    if (!supabase) return;

    let cancelled = false;

    const apply = (next: unknown) => {
      if (!cancelled && next != null && next !== "") {
        setStatus(coerceOrderStatus(next));
      }
    };

    const channel = supabase
      .channel(`order-live-${siteSlug}-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          apply((payload.new as { status?: string }).status);
        },
      )
      .subscribe();

    const poll = async () => {
      const { data } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .maybeSingle();
      if (data?.status) apply(String(data.status));
    };

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [orderId, siteSlug]);

  return coerceOrderStatus(status);
}
