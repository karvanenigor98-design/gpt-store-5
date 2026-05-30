"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clock3, Flame, Tag } from "lucide-react";

import { useHeroPromoOffer } from "@/hooks/use-hero-promo-offer";
import { promoDaysLeftLabel } from "@/lib/landing/promo-deadline";
import type { HeroPromoSiteKey } from "@/lib/landing/hero-promo-config";
import { fadeUp } from "@/lib/motion-config";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { cn } from "@/lib/utils";

type HeroPromoOfferCardProps = {
  site: HeroPromoSiteKey;
  className?: string;
  /** Spotify: широкая карточка как player card на desktop */
  layout?: "compact" | "wide";
};

export function HeroPromoOfferCard({ site, className, layout = "compact" }: HeroPromoOfferCardProps) {
  const { offer, daysLeft, deadlineLabel, promoTitle, loading } = useHeroPromoOffer(site);

  if (!offer && !loading) return null;
  if (!offer) return null;

  const isGpt = site === "gpt";
  const accent = isGpt ? "#10a37f" : SPOTIFY_ACCENT;
  const countdownText = promoDaysLeftLabel(daysLeft, deadlineLabel);
  const wide = layout === "wide";

  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border text-left shadow-lg",
        wide ? "max-w-none rounded-3xl p-6 sm:p-8" : "mx-auto max-w-md p-4 sm:p-5",
        isGpt
          ? "border-[#10a37f]/25 bg-white/90 shadow-emerald-600/10 backdrop-blur-sm"
          : "border-white/10 bg-white/[0.05] shadow-black/40 backdrop-blur-xl",
        className,
      )}
      style={
        !isGpt
          ? {
              boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(29,185,84,0.12)",
            }
          : undefined
      }
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isGpt
            ? "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(16,163,127,0.12) 0%, transparent 60%)"
            : "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(29,185,84,0.14) 0%, transparent 60%)",
        }}
      />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
            style={{
              background: isGpt ? "rgba(16,163,127,0.1)" : "rgba(29,185,84,0.15)",
              color: accent,
              border: `1px solid ${isGpt ? "rgba(16,163,127,0.25)" : "rgba(29,185,84,0.35)"}`,
            }}
          >
            <Flame className="h-3.5 w-3.5" aria-hidden />
            {promoTitle}
          </div>
          {offer.discountLabel ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{
                background: isGpt ? "#fef3c7" : "rgba(29,185,84,0.18)",
                color: isGpt ? "#92400e" : accent,
              }}
            >
              <Tag className="h-3 w-3" aria-hidden />
              {offer.discountLabel}
            </span>
          ) : null}
        </div>

        <p className={cn("mt-4 font-heading font-bold", isGpt ? "text-gray-900" : "text-white", wide ? "text-xl sm:text-2xl" : "text-lg")}>
          {offer.planName}
          <span className={cn("ml-2 text-base font-semibold", isGpt ? "text-gray-400" : "text-white/45")}>
            / {offer.periodLabel}
          </span>
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <span
            className={cn("font-heading text-lg font-semibold line-through", isGpt ? "text-gray-400" : "text-white/35")}
          >
            {offer.originalPrice.toLocaleString("ru")} ₽
          </span>
          <span className={cn("font-heading font-bold", isGpt ? "text-gray-900" : "text-white", wide ? "text-4xl" : "text-3xl")}>
            {offer.salePrice.toLocaleString("ru")}{" "}
            <span style={{ color: accent }}>₽</span>
          </span>
        </div>

        <div
          className={cn(
            "mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
            isGpt ? "bg-gray-50 text-gray-700" : "bg-black/30 text-white/80",
          )}
        >
          <Clock3 className="h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden />
          <span>{countdownText}</span>
        </div>

        <Link
          href={offer.checkoutHref}
          className={cn(
            "shimmer-btn relative mt-4 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90",
            wide && "sm:text-base",
          )}
          style={{
            background: accent,
            boxShadow: isGpt ? "0 4px 16px rgba(16,163,127,0.30)" : "0 4px 20px rgba(29,185,84,0.35)",
          }}
        >
          <span className="relative z-[2] inline-flex items-center justify-center gap-2">
            {offer.ctaLabel}
            <ArrowRight size={16} />
          </span>
        </Link>
      </div>
    </motion.div>
  );
}
