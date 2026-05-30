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
  const gptHero = isGpt && !wide;

  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border text-left shadow-lg",
        wide ? "max-w-none rounded-3xl p-6 sm:p-8" : gptHero
          ? "mx-auto max-w-md p-4 sm:p-5 md:max-w-xl md:rounded-3xl md:p-7 lg:max-w-2xl lg:p-8"
          : "mx-auto max-w-md p-4 sm:p-5",
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
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold uppercase tracking-wide",
              gptHero ? "text-xs md:px-4 md:py-2 md:text-sm" : "text-xs",
            )}
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
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold",
                gptHero ? "text-xs md:px-3 md:py-1.5 md:text-sm" : "text-xs",
              )}
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

        <p
          className={cn(
            "mt-4 font-heading font-bold",
            isGpt ? "text-gray-900" : "text-white",
            wide ? "text-xl sm:text-2xl" : gptHero ? "text-lg md:mt-5 md:text-2xl lg:text-3xl" : "text-lg",
          )}
        >
          {offer.planName}
          <span
            className={cn(
              "ml-2 font-semibold",
              isGpt ? "text-gray-400" : "text-white/45",
              gptHero ? "text-base md:text-lg lg:text-xl" : "text-base",
            )}
          >
            / {offer.periodLabel}
          </span>
        </p>

        <div className={cn("mt-3 flex flex-wrap items-end gap-2", gptHero && "md:mt-4 md:gap-3")}>
          <span
            className={cn(
              "font-heading font-semibold line-through",
              isGpt ? "text-gray-400" : "text-white/35",
              gptHero ? "text-lg md:text-2xl lg:text-3xl" : "text-lg",
            )}
          >
            {offer.originalPrice.toLocaleString("ru")} ₽
          </span>
          <span
            className={cn(
              "font-heading font-bold",
              isGpt ? "text-gray-900" : "text-white",
              wide ? "text-4xl" : gptHero ? "text-3xl md:text-5xl lg:text-6xl" : "text-3xl",
            )}
          >
            {offer.salePrice.toLocaleString("ru")}{" "}
            <span style={{ color: accent }}>₽</span>
          </span>
        </div>

        <div
          className={cn(
            "mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 font-medium",
            gptHero ? "text-sm md:mt-5 md:px-4 md:py-3 md:text-base" : "text-sm",
            isGpt ? "bg-gray-50 text-gray-700" : "bg-black/30 text-white/80",
          )}
        >
          <Clock3 className={cn("shrink-0", gptHero ? "h-4 w-4 md:h-5 md:w-5" : "h-4 w-4")} style={{ color: accent }} aria-hidden />
          <span>{countdownText}</span>
        </div>

        <Link
          href={offer.checkoutHref}
          className={cn(
            "shimmer-btn relative mt-4 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 font-semibold text-white transition-opacity hover:opacity-90",
            gptHero ? "py-3 text-sm md:mt-6 md:py-4 md:text-base lg:py-5 lg:text-lg" : "py-3 text-sm",
            wide && "sm:text-base",
          )}
          style={{
            background: accent,
            boxShadow: isGpt
              ? gptHero
                ? "0 8px 28px rgba(16,163,127,0.35)"
                : "0 4px 16px rgba(16,163,127,0.30)"
              : "0 4px 20px rgba(29,185,84,0.35)",
          }}
        >
          <span className="relative z-[2] inline-flex items-center justify-center gap-2">
            {offer.ctaLabel}
            <ArrowRight size={16} className={gptHero ? "md:h-[18px] md:w-[18px]" : undefined} />
          </span>
        </Link>
      </div>
    </motion.div>
  );
}
