"use client";

import {
  customerOrderStatusBadgeColor,
  customerOrderStatusLabelRu,
} from "@/lib/dashboard/customer-order-status-display";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

type StatusStyle = { label: string; color: string };

type Props = {
  status: string;
  siteSlug: SiteSlug;
  statusStyles?: Record<string, StatusStyle>;
};

/** Бейдж статуса в кабинете клиента. */
export function OrderLiveStatusBadge({ status, siteSlug, statusStyles }: Props) {
  const label = customerOrderStatusLabelRu(siteSlug, status);
  const variant = siteSlug === "subs-store" ? "subs" : "light";
  const color =
    statusStyles?.[status]?.color ?? customerOrderStatusBadgeColor(siteSlug, status, variant);

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${color}`}>
      {label}
    </span>
  );
}
