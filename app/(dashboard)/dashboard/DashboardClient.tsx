"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Package, CheckCircle, MessageCircle, Plus, ArrowRight } from "lucide-react";
import { buildCustomerOrderFocusHref, orderStatusForTracker } from "@/lib/dashboard/customer-order-view";
import { cn } from "@/lib/utils";
import { OrderStatusTracker } from "@/components/ui/OrderStatusTracker";
import { ClientLoyaltyBlock } from "@/components/ui/ClientLoyaltyBlock";
import { ReferralBlock } from "@/components/dashboard/ReferralBlock";
import { ReviewSubmitForm } from "@/components/dashboard/ReviewSubmitForm";
import type { OrderStatus } from "@/types/database";

interface Order {
  id: string;
  product: string;
  plan_id: string;
  price: number;
  status: string;
  created_at: string;
  activated_at?: string | null;
  expires_at?: string | null;
}

interface Props {
  userEmail: string;
  username: string | null;
  profileCreatedAt: string;
  orders: Order[];
  ordersCount: number;
  activeCount: number;
  chatsCount: number;
  siteSlug?: string;
  sitePrimaryColor?: string;
  siteBrandName?: string;
  siteCheckoutPath?: string;
  siteSupportPath?: string;
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  awaiting_payment: { label: "Ожидает", bg: "bg-yellow-100", text: "text-yellow-700" },
  pending: { label: "Ожидает", bg: "bg-yellow-100", text: "text-yellow-700" },
  paid: { label: "Оплачен", bg: "bg-emerald-100", text: "text-emerald-700" },
  processing: { label: "В работе", bg: "bg-blue-100", text: "text-blue-700" },
  activating: { label: "В работе", bg: "bg-blue-100", text: "text-blue-700" },
  waiting_client: { label: "Нужен токен", bg: "bg-orange-100", text: "text-orange-700" },
  active: { label: "Активно", bg: "bg-green-100", text: "text-green-700" },
  expired: { label: "Истекло", bg: "bg-gray-100", text: "text-gray-600" },
  failed: { label: "Ошибка", bg: "bg-red-100", text: "text-red-700" },
  refunded: { label: "Возврат", bg: "bg-gray-100", text: "text-gray-600" },
};

const STATUS_MAP_SUBS: Record<string, { label: string; bg: string; text: string }> = {
  awaiting_payment: { label: "Ожидает", bg: "bg-yellow-500/15", text: "text-yellow-200" },
  pending: { label: "Ожидает", bg: "bg-yellow-500/15", text: "text-yellow-200" },
  paid: { label: "Оплачен", bg: "bg-emerald-500/20", text: "text-emerald-200" },
  processing: { label: "В работе", bg: "bg-sky-500/15", text: "text-sky-200" },
  activating: { label: "В работе", bg: "bg-sky-500/15", text: "text-sky-200" },
  waiting_client: { label: "Нужен токен", bg: "bg-orange-500/15", text: "text-orange-200" },
  active: { label: "Активно", bg: "bg-emerald-500/20", text: "text-emerald-200" },
  expired: { label: "Истекло", bg: "bg-white/10", text: "text-gray-300" },
  failed: { label: "Ошибка", bg: "bg-red-500/15", text: "text-red-200" },
  refunded: { label: "Возврат", bg: "bg-white/10", text: "text-gray-300" },
};

const FU = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" },
} as const;

function getProductDisplayName(product: string, planId: string): string {
  if (product.startsWith("spotify")) {
    return `Spotify Premium — ${planId.replace("spotify-", "").replace(/-/g, " ")}`;
  }
  if (product === "chatgpt-plus") return "ChatGPT Plus";
  if (product === "chatgpt-pro") return "ChatGPT Pro";
  return `${product} — ${planId}`;
}

export function DashboardClient({
  userEmail,
  username,
  profileCreatedAt,
  orders,
  ordersCount,
  activeCount,
  chatsCount,
  siteSlug,
  sitePrimaryColor = "#10a37f",
  siteCheckoutPath = "/checkout",
  siteSupportPath = "/dashboard/chat",
}: Props) {
  const isSpotify = siteSlug === "subs-store";
  const primaryColor = sitePrimaryColor;
  const statusStyles = isSpotify ? STATUS_MAP_SUBS : STATUS_MAP;

  const activeOrPendingOrders = orders.filter((o) => {
    const s = o.status;
    return [
      "pending",
      "awaiting_payment",
      "paid",
      "processing",
      "waiting_client",
      "activating",
      "awaiting_data",
    ].includes(s);
  });
  const completedOrders = orders.filter((o) => o.status === "active").length;
  const recentOrders = orders.slice(0, 5);

  const greeting = username ? `Привет, ${username}!` : "Добро пожаловать!";

  return (
    <div className={cn("w-full max-w-none space-y-5", isSpotify && "text-gray-100")}>
      {/* Site context badge */}
      {isSpotify && (
        <div
          className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: "#000000",
            borderColor: `${primaryColor}40`,
            color: primaryColor,
          }}
        >
          Spotify Premium
        </div>
      )}

      {/* Header */}
      <motion.div
        {...FU}
        transition={{ ...FU.transition, delay: 0 }}
        className={cn(
          "flex items-center justify-between rounded-2xl border p-5",
          isSpotify
            ? "border-white/10 bg-[#161616] shadow-none"
            : "border-gray-100 bg-white shadow-sm"
        )}
      >
        <div>
          <h1 className={cn("text-xl font-bold", isSpotify ? "text-white" : "text-gray-900")}>{greeting}</h1>
          <p className={cn("mt-0.5 text-sm", isSpotify ? "text-gray-400" : "text-gray-500")}>{userEmail}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={siteCheckoutPath}
            className="hidden sm:flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
            style={{
              backgroundColor: primaryColor,
              boxShadow: `0 4px 12px ${primaryColor}33`,
            }}
          >
            <Plus size={15} />
            {isSpotify ? "Подключить Premium" : "Новый заказ"}
          </Link>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white shadow-sm"
            style={{ backgroundColor: primaryColor }}
          >
            {userEmail[0]?.toUpperCase()}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div {...FU} transition={{ ...FU.transition, delay: 0.07 }} className="grid grid-cols-3 gap-3">
        {[
          { icon: Package, label: "Заказов", value: ordersCount, color: primaryColor },
          { icon: CheckCircle, label: "Активных", value: activeCount, color: isSpotify ? "#38bdf8" : "#1a56db" },
          { icon: MessageCircle, label: "Обращений", value: chatsCount, color: isSpotify ? "#a78bfa" : "#8b5cf6" },
        ].map((card) => {
          const Icon = card.icon;
          return (
          <div
            key={card.label}
            className={cn(
              "rounded-2xl border p-4",
              isSpotify ? "border-white/10 bg-[#161616]" : "border-gray-100 bg-white shadow-sm"
            )}
          >
            <Icon size={18} style={{ color: card.color }} className="mb-2 opacity-80" />
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {card.value}
            </p>
            <p className={cn("mt-0.5 text-xs", isSpotify ? "text-gray-500" : "text-gray-500")}>{card.label}</p>
          </div>
          );
        })}
      </motion.div>

      {/* Active orders — real-time status trackers */}
      {activeOrPendingOrders.length > 0 && (
        <motion.div {...FU} transition={{ ...FU.transition, delay: 0.14 }} className="space-y-3">
          <h2
            className={cn(
              "text-sm font-semibold uppercase tracking-wide px-1",
              isSpotify ? "text-gray-500" : "text-gray-400"
            )}
          >
            В процессе
          </h2>
          {activeOrPendingOrders.map((order) => (
            <div key={order.id} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className={cn("text-sm font-semibold", isSpotify ? "text-gray-100" : "text-gray-800")}>
                  {getProductDisplayName(order.product, order.plan_id)}
                </p>
                <Link
                  href={siteSupportPath}
                  className="text-xs hover:underline"
                  style={{ color: primaryColor }}
                >
                  Написать в чат
                </Link>
              </div>
              <OrderStatusTracker
                orderId={order.id}
                initialStatus={orderStatusForTracker(order.status) as OrderStatus}
                planId={order.plan_id}
                activatedAt={order.activated_at ?? undefined}
                variant={isSpotify ? "subs" : "light"}
                chatHref={siteSupportPath}
                onOpenChat={() => {
                  window.location.href = siteSupportPath;
                }}
              />
            </div>
          ))}
        </motion.div>
      )}

      {/* Bottom grid: loyalty + orders table */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Loyalty block */}
        <motion.div {...FU} transition={{ ...FU.transition, delay: 0.21 }} className="lg:col-span-1 space-y-5">
          <ClientLoyaltyBlock
            createdAt={profileCreatedAt}
            completedOrders={completedOrders}
            totalOrders={ordersCount}
            variant={isSpotify ? "subs" : "default"}
          />
          {siteSlug && (
            <ReferralBlock siteSlug={siteSlug as "gpt-store" | "subs-store"} primaryColor={primaryColor} />
          )}
        </motion.div>

        {/* Recent orders */}
        <motion.div {...FU} transition={{ ...FU.transition, delay: 0.28 }} className="lg:col-span-2">
          <div
            className={cn(
              "rounded-2xl border shadow-sm overflow-hidden h-full",
              isSpotify ? "border-white/10 bg-[#161616]" : "border-gray-100 bg-white"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-between border-b px-5 py-3.5",
                isSpotify ? "border-white/10" : "border-gray-100"
              )}
            >
              <h2 className={cn("text-sm font-semibold", isSpotify ? "text-white" : "text-gray-900")}>
                {isSpotify ? "Spotify — последние заказы" : "Последние заказы"}
              </h2>
              <Link
                href={`/dashboard/orders${siteSlug ? `?site=${siteSlug}` : ""}`}
                className="flex items-center gap-1 text-xs hover:underline"
                style={{ color: primaryColor }}
              >
                Все заказы <ArrowRight size={12} />
              </Link>
            </div>

            {recentOrders.length === 0 ? (
              <div className="py-12 text-center">
                <p className={cn("mb-2 text-sm font-medium", isSpotify ? "text-gray-200" : "text-gray-600")}>
                  Пока нет заказов
                </p>
                <p className={cn("text-sm mb-4", isSpotify ? "text-gray-500" : "text-gray-500")}>
                  {isSpotify
                    ? "Подключите Spotify Premium в несколько кликов"
                    : "Оформите подписку в один клик"}
                </p>
                <Link
                  href={siteCheckoutPath}
                  className="inline-block rounded-xl px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isSpotify ? "Подключить Premium" : "Оформить подписку"}
                </Link>
              </div>
            ) : (
              <div className={cn("divide-y", isSpotify ? "divide-white/10" : "divide-gray-50")}>
                {recentOrders.map((order) => {
                  const statusInfo = statusStyles[order.status] ?? statusStyles.pending;
                  const canRepeat = ["expired", "failed"].includes(order.status);
                  const isActive = order.status === "active";
                  const orderHref =
                    siteSlug === "gpt-store" || siteSlug === "subs-store"
                      ? buildCustomerOrderFocusHref(siteSlug, order.id)
                      : `/dashboard/orders?order_id=${order.id}`;

                  return (
                    <Link
                      key={order.id}
                      href={orderHref}
                      className={cn(
                        "flex items-center gap-3 px-5 py-3 transition-colors",
                        isSpotify ? "hover:bg-white/[0.04]" : "hover:bg-gray-50/60"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-semibold truncate",
                            isSpotify ? "text-gray-100" : "text-gray-900"
                          )}
                        >
                          {getProductDisplayName(order.product, order.plan_id)}
                        </p>
                        <p className={cn("text-xs", isSpotify ? "text-gray-500" : "text-gray-400")}>
                          {new Date(order.created_at).toLocaleDateString("ru", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusInfo.bg} ${statusInfo.text}`}
                      >
                        {statusInfo.label}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-bold w-16 text-right",
                          isSpotify ? "text-white" : "text-gray-900"
                        )}
                      >
                        {order.price.toLocaleString("ru")} ₽
                      </span>
                      {(canRepeat || isActive) && (
                        <span
                          className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                          style={{
                            borderColor: `${primaryColor}40`,
                            color: primaryColor,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isActive ? "Продлить" : "Повторить"}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* CTA buttons */}
      <motion.div {...FU} transition={{ ...FU.transition, delay: 0.35 }} className="flex flex-wrap gap-3 pt-1">
        <Link
          href={siteCheckoutPath}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
          style={{
            backgroundColor: primaryColor,
            boxShadow: `0 4px 16px ${primaryColor}33`,
          }}
        >
          <Plus size={16} />
          {isSpotify ? "Подключить Premium" : "Новый заказ"}
        </Link>
        <Link
          href={siteSupportPath}
          className="flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors hover:opacity-80"
          style={{
            borderColor: `${primaryColor}4d`,
            color: primaryColor,
          }}
        >
          <MessageCircle size={16} />
          Написать в поддержку
        </Link>
      </motion.div>

      {(activeCount > 0 || orders.some((o) => o.status === "active")) && (
        <motion.div {...FU} transition={{ ...FU.transition, delay: 0.4 }} className="pt-2">
          <ReviewSubmitForm siteSlug={isSpotify ? "subs-store" : "gpt-store"} />
        </motion.div>
      )}
    </div>
  );
}
