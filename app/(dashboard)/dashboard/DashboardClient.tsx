"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Package, CheckCircle, MessageCircle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientLoyaltyBlock } from "@/components/ui/ClientLoyaltyBlock";
import { ReferralBlock } from "@/components/dashboard/ReferralBlock";
import { ReviewSubmitForm } from "@/components/dashboard/ReviewSubmitForm";
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

const FU = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" },
} as const;

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
  const completedOrders = orders.filter((o) => o.status === "active").length;
  const ordersHref = `/dashboard/orders${siteSlug ? `?site=${siteSlug}` : ""}`;

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
          { icon: Package, label: "Заказов", value: ordersCount, color: primaryColor, href: ordersHref },
          { icon: CheckCircle, label: "Активных", value: activeCount, color: isSpotify ? "#38bdf8" : "#1a56db" },
          { icon: MessageCircle, label: "Обращений", value: chatsCount, color: isSpotify ? "#a78bfa" : "#8b5cf6", href: siteSupportPath },
        ].map((card) => {
          const Icon = card.icon;
          const inner = (
            <>
              <Icon size={18} style={{ color: card.color }} className="mb-2 opacity-80" />
              <p className="text-2xl font-bold" style={{ color: card.color }}>
                {card.value}
              </p>
              <p className={cn("mt-0.5 text-xs", isSpotify ? "text-gray-500" : "text-gray-500")}>{card.label}</p>
            </>
          );
          const className = cn(
            "rounded-2xl border p-4 transition-colors",
            isSpotify ? "border-white/10 bg-[#161616]" : "border-gray-100 bg-white shadow-sm",
            card.href && (isSpotify ? "hover:bg-white/[0.04]" : "hover:bg-gray-50/80"),
          );
          return card.href ? (
            <Link key={card.label} href={card.href} className={className}>
              {inner}
            </Link>
          ) : (
            <div key={card.label} className={className}>
              {inner}
            </div>
          );
        })}
      </motion.div>

      {/* Loyalty + referral */}
      <motion.div {...FU} transition={{ ...FU.transition, delay: 0.14 }} className="grid gap-5 md:grid-cols-2">
        <ClientLoyaltyBlock
          createdAt={profileCreatedAt}
          completedOrders={completedOrders}
          totalOrders={ordersCount}
          variant={isSpotify ? "subs" : "default"}
        />
        {siteSlug ? (
          <ReferralBlock siteSlug={siteSlug as "gpt-store" | "subs-store"} primaryColor={primaryColor} />
        ) : null}
      </motion.div>

      {/* CTA buttons */}
      <motion.div {...FU} transition={{ ...FU.transition, delay: 0.21 }} className="flex flex-wrap gap-3 pt-1">
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
          href={ordersHref}
          className="flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors hover:opacity-80"
          style={{
            borderColor: `${primaryColor}4d`,
            color: primaryColor,
          }}
        >
          <Package size={16} />
          Мои заказы
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
