"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";

import { CustomerOrderCard } from "@/components/dashboard/CustomerOrderCard";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { sanitizeCustomerOrderView, type CustomerOrderView } from "@/lib/dashboard/customer-order-view";
import { cn } from "@/lib/utils";

type StatusStyle = { label: string; color: string };

type Props = {
  siteSlug: SiteSlug;
  orders: CustomerOrderView[];
  orderFocusId?: string | null;
  statusStyles: Record<string, StatusStyle>;
  primaryColor: string;
  checkoutPath: string;
  chatHref: string;
  payEmailFallback: string;
  isSubs: boolean;
};

type ErrorBoundaryState = { hasError: boolean };

class OrdersCardsErrorBoundary extends Component<{ children: ReactNode; chatHref: string; isSubs: boolean }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[CustomerOrdersSection]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4",
            this.props.isSubs ? "border-amber-500/30 bg-amber-500/10" : "border-amber-200 bg-amber-50",
          )}
        >
          <p className={cn("text-sm font-bold", this.props.isSubs ? "text-white" : "text-gray-900")}>
            Не удалось отобразить карточки заказов
          </p>
          <p className={cn("mt-1 text-sm", this.props.isSubs ? "text-gray-400" : "text-gray-600")}>
            Обновите страницу. Заказы в базе на месте — это сбой интерфейса.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className={cn(
              "mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-white",
              this.props.isSubs ? "bg-[#1DB954]" : "bg-[#10a37f]",
            )}
          >
            Обновить блок
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function CustomerOrdersSection({
  siteSlug,
  orders,
  orderFocusId,
  statusStyles,
  primaryColor,
  checkoutPath,
  chatHref,
  payEmailFallback,
  isSubs,
}: Props) {
  const safeOrders = orders.map(sanitizeCustomerOrderView);

  return (
    <OrdersCardsErrorBoundary chatHref={chatHref} isSubs={isSubs}>
      {!safeOrders.length ? (
        <div
          className={cn(
            "rounded-2xl border p-10 text-center",
            isSubs ? "border-white/10 bg-[#161616]" : "border-black/[0.07] bg-gray-50",
          )}
        >
          <p className={cn("mb-1 font-medium", isSubs ? "text-gray-100" : "text-gray-600")}>
            Заказов пока нет
          </p>
          <p className={cn("mb-5 text-sm", isSubs ? "text-gray-400" : "text-gray-400")}>
            {isSubs
              ? "Подключите Spotify Premium — активация 10–15 минут"
              : "Оформите первый заказ — активация за 5–15 минут"}
          </p>
          <Link
            href={checkoutPath}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            {isSubs ? "Подключить Premium" : "Оформить подписку"}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {safeOrders.map((order, index) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              siteSlug={siteSlug}
              statusStyles={statusStyles}
              primaryColor={primaryColor}
              checkoutPath={checkoutPath}
              chatHref={chatHref}
              payEmail={order.customer_email ?? payEmailFallback}
              isHighlighted={Boolean(orderFocusId && orderFocusId === order.id)}
              isNewest={index === 0}
            />
          ))}
        </div>
      )}
    </OrdersCardsErrorBoundary>
  );
}
