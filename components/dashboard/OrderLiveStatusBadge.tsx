import { gptOrderStatusLabelRu } from "@/lib/admin/gpt-order-status-labels";
import { subsOrderStatusLabelRu } from "@/lib/admin/subs-order-status-labels";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

type StatusStyle = { label: string; color: string };

type Props = {
  status: string;
  siteSlug: SiteSlug;
  statusStyles: Record<string, StatusStyle>;
};

/** Бейдж статуса (статус приходит снаружи — см. useOrderLiveStatus на карточке). */
export function OrderLiveStatusBadge({ status, siteSlug, statusStyles }: Props) {
  const label =
    siteSlug === "subs-store" ? subsOrderStatusLabelRu(status) : gptOrderStatusLabelRu(status);

  const style = statusStyles[status] ?? statusStyles.pending ?? statusStyles.awaiting_payment;

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${style?.color ?? ""}`}>
      {label}
    </span>
  );
}
