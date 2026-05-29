import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { MessageCircle, ArrowLeft } from "lucide-react";

import { OrderStatusTracker } from "@/components/ui/OrderStatusTracker";
import { OrderReceiptCard } from "@/components/ui/OrderReceiptCard";
import type { OrderStatus } from "@/types/database";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { resolveCustomerSiteSlug } from "@/lib/auth/resolveCustomerSiteSlug";
import { createSiteSessionClient } from "@/lib/supabase/site-session-server";
import { getSiteBySlug, filterOrdersBySite, isSpotifyProduct } from "@/lib/sites";
import {
  getOrderCustomerInstructionLines,
  orderStatusLabelRu,
} from "@/lib/email/order-customer-instructions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Статус заказа" };

function getProductDisplayName(product: string, planId: string): string {
  if (product.startsWith("spotify")) {
    const suffix = planId.replace(/^spotify-/, "").replace(/-/g, " ");
    return `Spotify Premium — ${suffix}`;
  }
  if (product === "chatgpt-plus") return "ChatGPT Plus";
  if (product === "chatgpt-pro") return "ChatGPT Pro";
  return `${product} — ${planId}`;
}

export default async function CustomerOrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ site?: string }>;
}) {
  const { orderId } = await params;
  const sp = await searchParams;

  const siteSlug: SiteSlug = await resolveCustomerSiteSlug({
    siteParam: sp.site,
    pathname: "/dashboard/order",
  });
  const site = getSiteBySlug(siteSlug);
  const isSubs = siteSlug === "subs-store";
  const primaryColor = site.primaryColor;
  const chatHref = `/dashboard/chat?site=${siteSlug}`;

  const { browserLike: supabase } = await createSiteSessionClient(siteSlug);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  if (siteSlug === "gpt-store" && isSpotifyProduct(order.product)) {
    redirect(`/dashboard/order/${orderId}?site=subs-store`);
  }
  if (siteSlug === "subs-store" && !isSpotifyProduct(order.product) && order.product) {
    const gptOrders = filterOrdersBySite([order], "gpt-store");
    if (gptOrders.length > 0) {
      redirect(`/dashboard/order/${orderId}?site=gpt-store`);
    }
  }

  const status = String(order.status ?? "pending");
  const instructions = getOrderCustomerInstructionLines(siteSlug, status, "updated");
  const statusLabel = orderStatusLabelRu(status);
  const isInProgress = ["pending", "waiting_client", "activating", "processing", "paid"].includes(
    status,
  );
  const isActive = status === "active" || status === "activated" || status === "completed";
  const isExpiredOrFailed = ["expired", "failed", "refunded", "problem"].includes(status);

  return (
    <div className={cn("mx-auto w-full max-w-2xl space-y-6", isSubs && "text-gray-100")}>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/dashboard/orders?site=${siteSlug}`}
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
            isSubs ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-900",
          )}
        >
          <ArrowLeft size={16} />
          Все заказы
        </Link>
      </div>

      <div>
        <p className={cn("text-xs font-medium uppercase tracking-wide", isSubs ? "text-gray-500" : "text-gray-400")}>
          {site.brandName}
        </p>
        <h1 className={cn("font-heading text-2xl font-bold", isSubs ? "text-white" : "text-gray-900")}>
          Статус заказа
        </h1>
        <p className={cn("mt-1 text-sm", isSubs ? "text-gray-400" : "text-gray-500")}>
          № {order.id.slice(0, 8)}… · {getProductDisplayName(order.product, order.plan_id)}
        </p>
      </div>

      <div
        className={cn(
          "rounded-2xl border p-5 shadow-sm",
          isSubs ? "border-white/10 bg-[#161616]" : "border-black/[0.07] bg-white",
        )}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: `${primaryColor}18`,
              color: primaryColor,
              border: `1px solid ${primaryColor}40`,
            }}
          >
            {statusLabel}
          </span>
          <p className={cn("text-lg font-bold", isSubs ? "text-white" : "text-gray-900")}>
            {order.price.toLocaleString("ru")} ₽
          </p>
        </div>

        <div
          className={cn(
            "mb-5 rounded-xl border px-4 py-3 text-sm leading-relaxed",
            isSubs ? "border-[#1DB954]/25 bg-[#1DB954]/10 text-gray-200" : "border-[#10a37f]/20 bg-[#10a37f]/8 text-gray-800",
          )}
        >
          {instructions.map((line, i) => (
            <p key={i} className={i > 0 ? "mt-1.5" : undefined}>
              {line}
            </p>
          ))}
        </div>

        {isInProgress && (
          <OrderStatusTracker
            orderId={order.id}
            initialStatus={status as OrderStatus}
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
          <Link
            href={`${site.checkoutPath}${order.plan_id ? `?plan=${order.plan_id}` : ""}`}
            className="mt-2 inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Оформить снова
          </Link>
        )}
      </div>

      <Link
        href={chatHref}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-colors",
          isSubs
            ? "border-white/15 bg-white/5 text-gray-100 hover:bg-white/10"
            : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50",
        )}
      >
        <MessageCircle size={18} style={{ color: primaryColor }} />
        Написать в поддержку
      </Link>
    </div>
  );
}
