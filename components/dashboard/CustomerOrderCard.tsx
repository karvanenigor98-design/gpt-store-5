import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { CompletePaymentButton } from "@/components/dashboard/CompletePaymentButton";
import { OrderReceiptCard } from "@/components/ui/OrderReceiptCard";
import { OrderStatusTracker } from "@/components/ui/OrderStatusTracker";
import type { OrderStatus } from "@/types/database";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import {
  getCustomerOrderProductLabel,
  isOrderAwaitingPayment,
  orderStatusForTracker,
  type CustomerOrderView,
} from "@/lib/dashboard/customer-order-view";
import { cn } from "@/lib/utils";

type StatusStyle = { label: string; color: string };

type Props = {
  order: CustomerOrderView;
  siteSlug: SiteSlug;
  statusInfo: StatusStyle;
  primaryColor: string;
  checkoutPath: string;
  chatHref: string;
  payEmail: string;
  isHighlighted?: boolean;
};

export function CustomerOrderCard({
  order,
  siteSlug,
  statusInfo,
  primaryColor,
  checkoutPath,
  chatHref,
  payEmail,
  isHighlighted = false,
}: Props) {
  const isSubs = siteSlug === "subs-store";
  const awaitingPay = isOrderAwaitingPayment(order.status);
  const isInProgress =
    awaitingPay ||
    ["waiting_client", "activating", "processing", "paid"].includes(order.status);
  const isActive = ["active", "activated", "completed"].includes(order.status);
  const isExpiredOrFailed = ["expired", "failed", "refunded", "problem"].includes(order.status);

  return (
    <div
      id={`row-${order.id}`}
      className={cn(
        "scroll-mt-6 overflow-hidden rounded-2xl border shadow-sm transition-shadow",
        isSubs ? "border-white/10 bg-[#161616]" : "border-black/[0.07] bg-white",
        isHighlighted &&
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
            {new Date(order.created_at).toLocaleDateString("ru", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="text-right">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
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
            initialStatus={orderStatusForTracker(order.status) as OrderStatus}
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
