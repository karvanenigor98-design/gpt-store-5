import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { CompletePaymentButton } from "@/components/dashboard/CompletePaymentButton";
import { OrderReceiptCard } from "@/components/ui/OrderReceiptCard";
import { OrderStatusTracker } from "@/components/ui/OrderStatusTracker";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { OrderLiveStatusBadge } from "@/components/dashboard/OrderLiveStatusBadge";
import {
  getCustomerOrderProductLabel,
  isOrderAwaitingPayment,
  type CustomerOrderView,
} from "@/lib/dashboard/customer-order-view";
import { shouldShowOrderStatusTracker } from "@/lib/dashboard/order-status-tracker";
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
  isNewest?: boolean;
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
  isNewest = false,
}: Props) {
  const isSubs = siteSlug === "subs-store";
  const awaitingPay = isOrderAwaitingPayment(order.status);
  const showTracker = shouldShowOrderStatusTracker(order.status);
  const isInProgress = showTracker;
  const isActive = ["active", "activated", "completed"].includes(order.status);
  const isExpiredOrFailed = ["expired", "failed", "refunded", "problem"].includes(order.status);

  return (
    <div
      id={`row-${order.id}`}
      className={cn(
        "scroll-mt-6 overflow-hidden rounded-2xl border shadow-sm transition-shadow",
        isSubs ? "bg-[#161616]" : "bg-white",
        isNewest
          ? isSubs
            ? "border-2 border-[#1DB954]/70 shadow-[0_0_24px_rgba(29,185,84,0.18)]"
            : "border-2 border-[#10a37f]/55 shadow-[0_0_20px_rgba(16,163,127,0.12)]"
          : isSubs
            ? "border border-white/10"
            : "border border-black/[0.07]",
        isHighlighted &&
          !isNewest &&
          (isSubs
            ? "ring-2 ring-[#1DB954]/40 ring-offset-2 ring-offset-[#0a0a0a]"
            : "ring-2 ring-[#10a37f]/30 ring-offset-2 ring-offset-gray-50"),
        isHighlighted &&
          isNewest &&
          (isSubs
            ? "ring-2 ring-[#1DB954]/55 ring-offset-2 ring-offset-[#0a0a0a]"
            : "ring-2 ring-[#10a37f]/45 ring-offset-2 ring-offset-gray-50"),
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
            {new Date(order.created_at).toLocaleDateString("ru", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="text-right">
          <OrderLiveStatusBadge
            orderId={order.id}
            siteSlug={siteSlug}
            initialStatus={order.status}
            statusStyles={statusStyles}
          />
          <p className={cn("mt-1 text-sm font-bold", isSubs ? "text-white" : "text-gray-900")}>
            {order.price.toLocaleString("ru")} ₽
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
            initialStatus={order.status}
            siteSlug={siteSlug}
            planId={order.plan_id}
            activatedAt={order.activated_at}
            variant={isSubs ? "subs" : "light"}
            chatHref={chatHref}
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
            <Link
              href={`${checkoutPath}?plan=${order.plan_id}`}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{
                backgroundColor: primaryColor,
                boxShadow: `0 2px 8px ${primaryColor}33`,
              }}
            >
              <RefreshCw size={12} />
              Повторить в 1 клик
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
