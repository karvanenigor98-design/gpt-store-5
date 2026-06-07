"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

type Props = {
  siteSlug: SiteSlug;
};

/** Обновляет таблицу заказов в админке/у оператора при изменении строк в БД (оплата, webhook, коллега). */
export function AdminOrdersLiveRefresh({ siteSlug }: Props) {
  const router = useRouter();
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    const supabase =
      siteSlug === "subs-store" ? tryCreateSubsBrowserClient() : createClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`staff-orders-${siteSlug}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          const now = Date.now();
          if (now - lastRefreshRef.current < 1200) return;
          lastRefreshRef.current = now;
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [siteSlug, router]);

  return null;
}
