"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { tryCreateSubsBrowserClient } from "@/lib/supabase/subs-browser-client";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { subsOrderStatusLabelRu } from "@/lib/admin/subs-order-status-labels";

type StatusStyle = { label: string; color: string };

const GPT_LABELS: Record<string, string> = {
  pending: "Ожидает оплаты",
  paid: "Оплачен",
  activating: "В работе",
  waiting_client: "Ожидает данных",
  active: "Активен",
  failed: "Ошибка",
  expired: "Истёк",
  refunded: "Возврат",
};

type Props = {
  orderId: string;
  siteSlug: SiteSlug;
  initialStatus: string;
  statusStyles: Record<string, StatusStyle>;
};

export function OrderLiveStatusBadge({
  orderId,
  siteSlug,
  initialStatus,
  statusStyles,
}: Props) {
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    const supabase =
      siteSlug === "subs-store" ? tryCreateSubsBrowserClient() : createClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`order-badge-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          const next = (payload.new as { status?: string }).status;
          if (next) setStatus(next);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId, siteSlug]);

  const label =
    siteSlug === "subs-store"
      ? subsOrderStatusLabelRu(status)
      : (GPT_LABELS[status] ?? status);

  const style = statusStyles[status] ?? statusStyles.pending ?? statusStyles.awaiting_payment;

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style?.color ?? ""}`}>
      {label}
    </span>
  );
}
