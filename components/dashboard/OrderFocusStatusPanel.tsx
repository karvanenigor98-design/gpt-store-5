"use client";

import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { customerOrderStatusLabelRu } from "@/lib/dashboard/customer-order-status-display";
import { getOrderCustomerInstructionLines } from "@/lib/email/order-customer-instructions";
import { useOrderLiveStatus } from "@/lib/dashboard/use-order-live-status";
import { cn } from "@/lib/utils";

type Props = {
  orderId: string;
  siteSlug: SiteSlug;
  initialStatus: string;
  isSubs: boolean;
};

/** Блок «Статус заказа» над списком — обновляется при смене в админке. */
export function OrderFocusStatusPanel({ orderId, siteSlug, initialStatus, isSubs }: Props) {
  const live = useOrderLiveStatus(orderId, siteSlug, initialStatus);
  const liveStatus = live.status;
  const lines = getOrderCustomerInstructionLines(siteSlug, liveStatus, "updated");

  return (
    <div
      className={cn(
        "rounded-2xl border px-5 py-4",
        isSubs ? "border-[#1DB954]/30 bg-[#1DB954]/10" : "border-[#10a37f]/25 bg-[#10a37f]/5",
      )}
    >
      <p className={cn("text-sm font-bold", isSubs ? "text-white" : "text-gray-900")}>
        Статус заказа: {customerOrderStatusLabelRu(siteSlug, liveStatus)}
      </p>
      <ul className={cn("mt-2 space-y-1 text-sm", isSubs ? "text-gray-300" : "text-gray-600")}>
        {lines.map((line, i) => (
          <li key={`${i}-${line}`}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
