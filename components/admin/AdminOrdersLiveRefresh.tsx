"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { tryCreateClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

type Props = {
  siteSlug: SiteSlug;
};

/** Обновляет таблицу заказов в админке/у оператора при изменении строк в БД (оплата, webhook, коллега). */
export function AdminOrdersLiveRefresh({ siteSlug }: Props) {
  const router = useRouter();

  useEffect(() => {
    const supabase =
      siteSlug === "subs-store" ? tryCreateSubsBrowserClient() : tryCreateClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`staff-orders-${siteSlug}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
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
