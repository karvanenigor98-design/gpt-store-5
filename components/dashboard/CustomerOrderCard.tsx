"use client";

import Link from "next/link";
import { MessageCircle, RefreshCw } from "lucide-react";

import { CheckoutNavButton } from "@/components/checkout/CheckoutNavButton";
import { CompletePaymentButton } from "@/components/dashboard/CompletePaymentButton";
import type { AuthSiteSlug } from "@/lib/auth/detectAuthSite";
import { OrderReceiptCard } from "@/components/ui/OrderReceiptCard";
import { OrderStatusTracker } from "@/components/ui/OrderStatusTracker";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { OrderLiveStatusBadge } from "@/components/dashboard/OrderLiveStatusBadge";
import {
  formatCustomerOrderDateRu,
  getCustomerOrderProductLabel,
  isOrderAwaitingPayment,
  resolveCustomerOrderDisplayDateIso,
  type CustomerOrderView,
} from "@/lib/dashboard/customer-order-view";
import { shouldShowOrderStatusTracker } from "@/lib/dashboard/order-status-tracker";
import { useOrderLiveStatus } from "@/lib/dashboard/use-order-live-status";
import { cn } from "@/lib/utils";

type StatusStyle = { label: string; color: string };

type Props = {
  order: CustomerOrderView;
  siteSlug: SiteSlug;
  statusStyles: Record<string, StatusStyle>;
  primaryColor: string;
  checkoutPath: string;
  chatHref: string;
  payEmail: string;
  isHighlighted?: boolean;
  isPrimary?: boolean;
};

export function CustomerOrderCard({
  order,
  siteSlug,
  statusStyles,
  primaryColor,
  checkoutPath,
  chatHref,
  payEmail,
  isHighlighted = false,
  isPrimary = false,
}: Props) {
  const isSubs = siteSlug === "subs-store";
  const live = useOrderLiveStatus(order.id, siteSlug, order.status);
  const liveStatus = live.status;
  const priceLabel = `${(Number(order.price) || 0).toLocaleString("ru")} ₽`;
  const awaitingPay = !live.paidLike && isOrderAwaitingPayment(liveStatus);
  const showTracker = shouldShowOrderStatusTracker(liveStatus);
  const isInProgress = showTracker;
  const isActive = ["active", "activated", "completed"].includes(liveStatus);
  const isExpiredOrFailed = ["expired", "failed", "refunded", "problem", "cancelled"].includes(
    liveStatus,
  );
  const displayDateIso = resolveCustomerOrderDisplayDateIso(order, live.paidLike, live.paidAt);
  const displayDateLabel = formatCustomerOrderDateRu(displayDateIso);

  return (
    <div
      id={`row-${order.id}`}
      className={cn(
        "scroll-mt-6 overflow-hidden rounded-2xl border shadow-sm transition-shadow",
        isSubs ? "bg-[#161616]" : "bg-white",
        isPrimary
          ? isSubs
            ? "border-2 border-[#1DB954] shadow-[0_0_28px_rgba(29,185,84,0.35)] ring-2 ring-[#1DB954]/45 ring-offset-2 ring-offset-[#0a0a0a]"
            : "border-2 border-[#10a37f] shadow-[0_0_24px_rgba(16,163,127,0.28)] ring-2 ring-[#10a37f]/40 ring-offset-2 ring-offset-gray-50"
          : isSubs
            ? "border border-white/10"
            : "border border-black/[0.07]",
        isHighlighted &&
          !isPrimary &&
          (isSubs
            ? "ring-2 ring-[#1DB954]/40 ring-offset-2 ring-offset-[#0a0a0a]"
            : "ring-2 ring-[#10a37f]/30 ring-offset-2 ring-offset-gray-50"),
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-5 py-4",
          isSubs ? "border-white/10" : "border-gray-50",
        )}
      >
        <div>
          <p className={cn("text-sm font-bold", isSubs ? "text-white" : "text-gray-900")}>
            {getCustomerOrderProductLabel(order)}
          </p>
          <p className={cn("mt-0.5 text-xs", isSubs ? "text-gray-500" : "text-gray-400")}>
            {displayDateLabel}
          </p>
        </div>
        <div className="text-right">
          <OrderLiveStatusBadge status={liveStatus} siteSlug={siteSlug} statusStyles={statusStyles} />
          <p className={cn("mt-1 text-sm font-bold", isSubs ? "text-white" : "text-gray-900")}>
            {priceLabel}
          </p>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        {awaitingPay && payEmail ? (
          <CompletePaymentButton
            siteSlug={siteSlug}
            orderId={order.id}
            planId={order.plan_id}
            accountEmail={payEmail}
            variant={isSubs ? "subs" : "gpt"}
          />
        ) : null}

        {isInProgress ? (
          <OrderStatusTracker
            orderId={order.id}
            initialStatus={liveStatus}
            siteSlug={siteSlug}
            planId={order.plan_id}
            activatedAt={order.activated_at}
            variant={isSubs ? "subs" : "light"}
          />
        ) : null}

        {isActive && order.activated_at ? (
          <OrderReceiptCard
            product={order.product}
            planId={order.plan_id}
            price={order.price}
            activatedAt={order.activated_at}
            expiresAt={order.expires_at}
            variant={isSubs ? "subs" : "light"}
          />
        ) : null}

        {isExpiredOrFailed ? (
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border px-4 py-3",
              isSubs ? "border-white/10 bg-[#111111]" : "border-gray-100 bg-gray-50",
            )}
          >
            <div>
              <p className={cn("text-xs font-semibold", isSubs ? "text-gray-200" : "text-gray-700")}>
                Оформить снова?
              </p>
              <p className={cn("mt-0.5 text-[11px]", isSubs ? "text-gray-500" : "text-gray-400")}>
                Тот же тариф — один клик
              </p>
            </div>
            <CheckoutNavButton
              siteSlug={siteSlug as AuthSiteSlug}
              planId={order.plan_id}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{
                backgroundColor: primaryColor,
                boxShadow: `0 2px 8px ${primaryColor}33`,
              }}
            >
              <RefreshCw size={12} />
              Повторить в 1 клик
            </CheckoutNavButton>
          </div>
        ) : null}

        {isPrimary ? (
          <Link
            href={chatHref}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-colors",
              isSubs
                ? "border-[#1DB954]/40 text-[#1DB954] hover:bg-[#1DB954]/10"
                : "border-[#10a37f]/35 text-[#10a37f] hover:bg-[#10a37f]/5",
            )}
          >
            <MessageCircle size={16} />
            Написать в поддержку
          </Link>
        ) : null}
      </div>
    </div>
  );
}
