import { OrderStatusTracker } from "@/components/ui/OrderStatusTracker";
import { OrderReceiptCard } from "@/components/ui/OrderReceiptCard";
import { HighlightScroll } from "@/components/ui/HighlightScroll";
import { CompletePaymentButton } from "@/components/dashboard/CompletePaymentButton";
import Link from "next/link";
import type { Metadata } from "next";
import type { OrderStatus } from "@/types/database";
import { RefreshCw, Plus } from "lucide-react";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { resolveCustomerSiteSlug } from "@/lib/auth/resolveCustomerSiteSlug";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import { getSiteBySlug } from "@/lib/sites";
import {
  getOrderCustomerInstructionLines,
  orderStatusLabelRu,
} from "@/lib/email/order-customer-instructions";
import { loadCustomerOrdersForUser } from "@/lib/dashboard/load-customer-orders";
import {
  getCustomerOrderProductLabel,
  isOrderAwaitingPayment,
  orderStatusForTracker,
} from "@/lib/dashboard/customer-order-view";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Мои заказы" };

const STATUS_LABELS_LIGHT: Record<string, { label: string; color: string }> = {
  awaiting_payment: { label: "Ожидает оплаты", color: "text-amber-600 bg-amber-50 border-amber-200" },
  pending: { label: "Ожидает оплаты", color: "text-amber-600 bg-amber-50 border-amber-200" },
  activating: { label: "Активируется", color: "text-blue-600 bg-blue-50 border-blue-200" },
  waiting_client: { label: "Ожидает данных", color: "text-orange-600 bg-orange-50 border-orange-200" },
  active: { label: "Активен", color: "text-green-600 bg-[#10a37f]/8 border-[#10a37f]/20" },
  failed: { label: "Ошибка", color: "text-red-600 bg-red-50 border-red-200" },
  expired: { label: "Истёк", color: "text-gray-500 bg-gray-50 border-gray-200" },
  refunded: { label: "Возврат", color: "text-gray-500 bg-gray-50 border-gray-200" },
  paid: { label: "Оплачен", color: "text-blue-600 bg-blue-50 border-blue-200" },
  processing: { label: "В обработке", color: "text-blue-600 bg-blue-50 border-blue-200" },
  awaiting_data: { label: "Ожидает данных", color: "text-orange-600 bg-orange-50 border-orange-200" },
  activated: { label: "Активирован", color: "text-green-600 bg-green-50 border-green-200" },
  completed: { label: "Завершён", color: "text-green-700 bg-green-50 border-green-200" },
};

const STATUS_LABELS_SUBS: Record<string, { label: string; color: string }> = {
  awaiting_payment: { label: "Ожидает оплаты", color: "text-yellow-200 bg-yellow-500/15 border-yellow-500/30" },
  pending: { label: "Ожидает оплаты", color: "text-yellow-200 bg-yellow-500/15 border-yellow-500/30" },
  activating: { label: "Активируется", color: "text-sky-200 bg-sky-500/15 border-sky-500/30" },
  waiting_client: { label: "Ожидает данных", color: "text-orange-200 bg-orange-500/15 border-orange-500/30" },
  active: { label: "Активен", color: "text-emerald-200 bg-emerald-500/20 border-emerald-500/30" },
  failed: { label: "Ошибка", color: "text-red-200 bg-red-500/15 border-red-500/30" },
  expired: { label: "Истёк", color: "text-gray-300 bg-white/10 border-white/15" },
  refunded: { label: "Возврат", color: "text-gray-300 bg-white/10 border-white/15" },
  paid: { label: "Оплачен", color: "text-emerald-200 bg-emerald-500/20 border-emerald-500/30" },
  processing: { label: "В обработке", color: "text-sky-200 bg-sky-500/15 border-sky-500/30" },
  awaiting_data: { label: "Ожидает данных", color: "text-orange-200 bg-orange-500/15 border-orange-500/30" },
  activated: { label: "Активирован", color: "text-emerald-200 bg-emerald-500/20 border-emerald-500/30" },
  completed: { label: "Завершён", color: "text-emerald-200 bg-emerald-500/20 border-emerald-500/30" },
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; highlight?: string; order_id?: string }>;
}) {
  const params = await searchParams;
  const siteSlug: SiteSlug = await resolveCustomerSiteSlug({
    siteParam: params.site,
    pathname: "/dashboard/orders",
  });

  const orderFocus = params.highlight ?? params.order_id;
  const site = getSiteBySlug(siteSlug);
  const isSubs = siteSlug === "subs-store";
  const STATUS_LABELS = isSubs ? STATUS_LABELS_SUBS : STATUS_LABELS_LIGHT;
  const chatHref = `/dashboard/chat?site=${siteSlug}`;
  const primaryColor = site.primaryColor;

  const { browserLike: supabase } = await createSiteSessionClient(siteSlug);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const orders = await loadCustomerOrdersForUser({
    siteSlug,
    userId: user.id,
    userEmail: user.email ?? null,
  });

  const focusedOrder = orderFocus ? orders.find((o) => o.id === orderFocus) : undefined;
  const orderFocusMissing = Boolean(orderFocus && !focusedOrder);

  return (
    <div className={cn("w-full max-w-none space-y-6", isSubs && "text-gray-100")}>
      <HighlightScroll accent={isSubs ? "subs" : "gpt"} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={cn("font-heading text-2xl font-bold", isSubs ? "text-white" : "text-gray-900")}>
          {isSubs ? "Spotify — История заказов" : "История заказов"}
        </h1>
        <Link
          href={site.checkoutPath}
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
          style={{
            backgroundColor: primaryColor,
            boxShadow: `0 4px 8px ${primaryColor}33`,
          }}
        >
          <Plus size={15} />
          {isSubs ? "Подключить Premium" : "Новый заказ"}
        </Link>
      </div>

      {orderFocusMissing ? (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4",
            isSubs ? "border-amber-500/30 bg-amber-500/10" : "border-amber-200 bg-amber-50",
          )}
        >
          <p className={cn("text-sm font-bold", isSubs ? "text-white" : "text-gray-900")}>
            Заказ не найден или относится к другому аккаунту
          </p>
          <p className={cn("mt-1 text-sm", isSubs ? "text-gray-400" : "text-gray-600")}>
            Проверьте, что вы вошли в кабинет того же магазина, где оформляли заказ.
          </p>
          <Link
            href={chatHref}
            className={cn("mt-3 inline-block text-sm font-semibold underline", isSubs ? "text-[#1DB954]" : "text-[#10a37f]")}
          >
            Написать в поддержку
          </Link>
        </div>
      ) : null}

      {focusedOrder ? (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4",
            isSubs ? "border-[#1DB954]/30 bg-[#1DB954]/10" : "border-[#10a37f]/25 bg-[#10a37f]/5",
          )}
        >
          <p className={cn("text-sm font-bold", isSubs ? "text-white" : "text-gray-900")}>
            Статус заказа: {orderStatusLabelRu(focusedOrder.status)}
          </p>
          <ul className={cn("mt-2 space-y-1 text-sm", isSubs ? "text-gray-300" : "text-gray-600")}>
            {getOrderCustomerInstructionLines(siteSlug, focusedOrder.status, "updated").map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!orders || orders.length === 0 ? (
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
            href={site.checkoutPath}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColor }}
          >
            {isSubs ? "Подключить Premium" : "Оформить подписку"}
          </Link>
          {isSubs ? (
            <p className="mt-6 text-xs text-gray-500">
              Вопросы по подключению — напишите в чат справа (или ниже на телефоне).
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusInfo = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending;
            const awaitingPay = isOrderAwaitingPayment(order.status);
            const isInProgress =
              awaitingPay ||
              ["waiting_client", "activating", "processing", "paid"].includes(order.status);
            const isActive = ["active", "activated", "completed"].includes(order.status);
            const isExpiredOrFailed = ["expired", "failed", "refunded", "problem"].includes(order.status);
            const payEmail =
              order.customer_email ?? order.account_email ?? user.email ?? "";

            return (
              <div
                key={order.id}
                id={`row-${order.id}`}
                className={cn(
                  "scroll-mt-6 overflow-hidden rounded-2xl border shadow-sm",
                  isSubs ? "border-white/10 bg-[#161616]" : "border-black/[0.07] bg-white",
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

                  {isInProgress && (
                    <OrderStatusTracker
                      orderId={order.id}
                      initialStatus={orderStatusForTracker(order.status) as OrderStatus}
                      planId={order.plan_id}
                      activatedAt={order.activated_at}
                      variant={isSubs ? "subs" : "light"}
                      chatHref={chatHref}
                    />
                  )}

                  {isActive && order.activated_at && (
                    <OrderReceiptCard
                      product={order.product}
                      planId={order.plan_id}
                      price={order.price}
                      activatedAt={order.activated_at}
                      expiresAt={order.expires_at}
                      variant={isSubs ? "subs" : "light"}
                    />
                  )}

                  {isExpiredOrFailed && (
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
                        href={`${site.checkoutPath}?plan=${order.plan_id}`}
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
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isSubs && (
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href={chatHref}
            className="flex items-center gap-2 rounded-xl border border-black/[0.08] px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Написать в поддержку
          </Link>
        </div>
      )}
    </div>
  );
}
