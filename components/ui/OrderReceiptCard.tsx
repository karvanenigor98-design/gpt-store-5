"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Calendar, Shield, RefreshCw, MessageCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  product: string;
  planId: string;
  price: number;
  activatedAt: string;
  expiresAt?: string | null;
  variant?: "light" | "subs";
}

export function OrderReceiptCard({
  product,
  planId,
  price,
  activatedAt,
  expiresAt,
  variant = "light",
}: Props) {
  const isSubs = variant === "subs";
  const accent = isSubs ? "#1DB954" : "#10a37f";

  const productName = product.startsWith("spotify")
    ? `Spotify Premium — ${planId.replace(/^spotify-/, "").replace(/-/g, " ")}`
    : product === "chatgpt-plus"
      ? "ChatGPT Plus"
      : product === "chatgpt-pro"
        ? "ChatGPT Pro"
        : `${product} · ${planId}`;

  const activatedDate = new Date(activatedAt).toLocaleDateString("ru", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const expiresDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString("ru", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const now = new Date();
  const expiry = expiresAt ? new Date(expiresAt) : null;
  const daysLeft = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const isExpiringSoon = daysLeft !== null && daysLeft <= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "overflow-hidden rounded-2xl border shadow-sm",
        isSubs
          ? "border-[#1DB954]/25 bg-gradient-to-br from-[#1DB954]/10 to-[#111111]"
          : "border-[#10a37f]/20 bg-gradient-to-br from-[#10a37f]/[0.04] to-white",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-3 border-b border-dashed px-5 py-4",
          isSubs ? "border-[#1DB954]/25" : "border-[#10a37f]/20",
        )}
      >
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
          style={{ backgroundColor: accent, boxShadow: `0 4px 12px ${accent}40` }}
        >
          <CheckCircle2 size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-bold", isSubs ? "text-white" : "text-gray-900")}>
            Подписка активирована
          </p>
          <p className="mt-0.5 text-xs font-semibold" style={{ color: accent }}>
            {productName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("text-lg font-bold", isSubs ? "text-white" : "text-gray-900")}>
            {price.toLocaleString("ru")} ₽
          </p>
          <p className={cn("text-[10px] font-medium uppercase tracking-wide", isSubs ? "text-gray-500" : "text-gray-400")}>
            оплачено
          </p>
        </div>
      </div>

      {/* Details */}
      <div className="px-5 py-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className={cn("flex items-center gap-1.5", isSubs ? "text-gray-500" : "text-gray-500")}>
            <Calendar size={12} />
            Дата активации
          </div>
          <span className={cn("font-semibold", isSubs ? "text-gray-200" : "text-gray-800")}>
            {activatedDate}
          </span>
        </div>

        {expiresDate && (
          <div className="flex items-center justify-between text-xs">
            <div className={cn("flex items-center gap-1.5", isSubs ? "text-gray-500" : "text-gray-500")}>
              <Calendar size={12} />
              Действует до
            </div>
            <span className={cn("font-semibold", isSubs ? "text-gray-200" : "text-gray-800")}>
              {expiresDate}
            </span>
          </div>
        )}

        {daysLeft !== null && (
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold",
              isExpiringSoon
                ? isSubs
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-amber-200/70 bg-amber-50 text-amber-700"
                : isSubs
                  ? "border-[#1DB954]/25 bg-[#1DB954]/10 text-[#1DB954]"
                  : "border-[#10a37f]/15 bg-[#10a37f]/6 text-[#10a37f]",
            )}
          >
            <span>{isExpiringSoon ? "⚠️ Скоро истекает" : "✅ Активна"}</span>
            <span>
              {daysLeft === 0
                ? "Истекает сегодня"
                : `Осталось ${daysLeft} ${daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"}`}
            </span>
          </div>
        )}

        {/* Guarantee block */}
        <div
          className={cn(
            "mt-1 flex items-start gap-2.5 rounded-xl border px-3.5 py-3",
            isSubs ? "border-white/10 bg-[#1a1a1a]" : "border-black/[0.06] bg-white",
          )}
        >
          <Shield size={15} className="mt-0.5 shrink-0" style={{ color: accent }} />
          <div>
            <p className={cn("mb-0.5 text-xs font-bold", isSubs ? "text-white" : "text-gray-800")}>
              Гарантия 30 дней
            </p>
            <p className={cn("text-[11px] leading-relaxed", isSubs ? "text-gray-400" : "text-gray-500")}>
              Если подписка перестанет работать — переактивируем бесплатно или вернём деньги. Без вопросов.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-3 gap-2 px-5 pb-4">
        <Link
          href={isSubs ? `/checkout/spotify?plan=${planId}` : `/checkout?plan=${planId}`}
          className="flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition-colors"
          style={{
            borderColor: `${accent}4d`,
            backgroundColor: `${accent}0d`,
            color: accent,
          }}
        >
          <RefreshCw size={13} />
          Продлить
        </Link>
        <Link
          href={isSubs ? "/dashboard/chat?site=subs-store" : "/support"}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors",
            isSubs
              ? "border-white/10 text-gray-300 hover:bg-white/5"
              : "border-black/[0.08] text-gray-600 hover:bg-gray-50",
          )}
        >
          <MessageCircle size={13} />
          Поддержка
        </Link>
        <Link
          href={isSubs ? "/dashboard/reviews?site=subs-store" : "/reviews"}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition-colors",
            isSubs
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
              : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
          )}
        >
          ⭐ Оставить отзыв
        </Link>
      </div>
    </motion.div>
  );
}
