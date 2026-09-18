"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock3, Flame, Percent, PiggyBank, CalendarDays } from "lucide-react";

import { useHeroPromoOffer } from "@/hooks/use-hero-promo-offer";
import { promoCountdownLabel } from "@/lib/landing/promo-deadline";
import type { HeroPromoSiteKey } from "@/lib/landing/hero-promo-config";
import { fadeUp } from "@/lib/motion-config";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { ConnectCheckoutButton } from "@/components/checkout/ConnectCheckoutButton";
import { HeroPromoTermsPopover } from "@/components/landing/HeroPromoTermsPopover";
import { parsePlanIdFromCheckoutPath } from "@/lib/checkout/checkout-intent";
import { cn } from "@/lib/utils";

type HeroPromoOfferCardProps = {
  site: HeroPromoSiteKey;
  className?: string;
  layout?: "compact" | "wide";
};

export function HeroPromoOfferCard({ site, className, layout = "compact" }: HeroPromoOfferCardProps) {
  const { offer, daysLeft, loading } = useHeroPromoOffer(site);
  const reduceMotion = useReducedMotion();

  if (loading && !offer) {
    const isGpt = site === "gpt";
    const wide = layout === "wide";
    return (
      <div
        className={cn(
          "relative w-full animate-pulse overflow-hidden rounded-2xl border",
          wide ? "min-h-[280px] rounded-3xl" : "mx-auto min-h-[220px] max-w-md",
          isGpt ? "border-[#10a37f]/20 bg-white/80" : "border-white/10 bg-white/[0.05]",
          className,
        )}
        aria-hidden
      />
    );
  }

  if (!offer) return null;

  const isGpt = site === "gpt";
  const accent = isGpt ? "#10a37f" : SPOTIFY_ACCENT;
  const planId = parsePlanIdFromCheckoutPath(offer.checkoutHref);
  const siteSlug = isGpt ? "gpt-store" : "subs-store";
  const promo = offer.promoActive;
  const wide = layout === "wide";
  const countdown = promo ? promoCountdownLabel(Math.max(0, daysLeft)) : null;

  const banner = (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold tracking-wide",
        !reduceMotion && promo && "shimmer-btn relative overflow-hidden",
      )}
      style={{
        background: isGpt ? "rgba(16,163,127,0.12)" : "rgba(29,185,84,0.16)",
        color: accent,
        border: `1px solid ${isGpt ? "rgba(16,163,127,0.28)" : "rgba(29,185,84,0.35)"}`,
      }}
    >
      <Flame className="relative z-[2] h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="relative z-[2] truncate">
        {promo && offer.promoBanner ? offer.promoBanner : isGpt ? "ChatGPT Plus" : "Spotify Premium"}
      </span>
    </span>
  );

  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl border text-left shadow-lg",
        wide ? "max-w-none rounded-3xl p-5 sm:p-7" : "mx-auto max-w-md p-4 sm:p-5",
        isGpt
          ? cn(
              "bg-white/95 shadow-emerald-600/10 backdrop-blur-sm",
              promo ? "border-[#10a37f]/40 ring-1 ring-[#10a37f]/15" : "border-[#10a37f]/25",
            )
          : "border-white/10 bg-white/[0.05] shadow-black/40 backdrop-blur-xl",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isGpt
            ? "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(16,163,127,0.14) 0%, transparent 60%)"
            : "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(29,185,84,0.14) 0%, transparent 60%)",
        }}
      />

      <div className="relative space-y-3">
        {promo && offer.terms.length ? (
          <HeroPromoTermsPopover terms={offer.terms} accent={accent} isDark={!isGpt}>
            {banner}
          </HeroPromoTermsPopover>
        ) : (
          banner
        )}

        <div>
          <p
            className={cn(
              "font-heading font-bold leading-snug",
              isGpt ? "text-gray-900" : "text-white",
              wide ? "text-xl sm:text-2xl" : "text-lg",
            )}
          >
            {offer.displayPlanName || offer.planName}
            {offer.displayPlanName ? null : (
              <span
                className={cn(
                  "ml-2 text-base font-semibold",
                  isGpt ? "text-gray-400" : "text-white/45",
                )}
              >
                / {offer.periodLabel}
              </span>
            )}
          </p>
          {offer.offerHeadline ? (
            <p
              className={cn(
                "mt-1.5 text-sm font-medium leading-snug",
                isGpt ? "text-[#0f7d62]" : "text-[#1DB954]",
              )}
            >
              {offer.offerHeadline}
            </p>
          ) : null}
          {offer.offerSubline ? (
            <p className={cn("mt-1 text-xs leading-snug", isGpt ? "text-gray-500" : "text-white/50")}>
              {offer.offerSubline}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-x-3 gap-y-1" aria-label="Цена">
          {promo ? (
            <span
              className={cn(
                "font-heading text-base font-semibold line-through sm:text-lg",
                isGpt ? "text-gray-400" : "text-white/40",
              )}
              aria-label={`Было ${offer.originalPrice.toLocaleString("ru")} рублей`}
            >
              {offer.originalPrice.toLocaleString("ru")} ₽
            </span>
          ) : null}
          <span
            className={cn(
              "font-heading font-bold leading-none",
              isGpt ? "text-gray-900" : "text-white",
              wide ? "text-4xl" : "text-3xl",
            )}
            aria-label={`Сейчас ${offer.salePrice.toLocaleString("ru")} рублей`}
          >
            {offer.salePrice.toLocaleString("ru")}{" "}
            <span style={{ color: accent }}>₽</span>
          </span>
        </div>

        {promo ? (
          <div className="flex flex-wrap gap-1.5">
            {!isGpt && offer.discountLabel ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  "bg-[rgba(29,185,84,0.14)] text-[#1DB954]",
                )}
              >
                <Percent className="h-3 w-3" aria-hidden />
                {offer.discountLabel}
              </span>
            ) : null}
            {offer.savingsRub > 0 ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  isGpt ? "bg-gray-100 text-gray-700" : "bg-white/8 text-white/80",
                )}
              >
                <PiggyBank className="h-3 w-3" aria-hidden />
                {isGpt
                  ? `−${offer.savingsRub.toLocaleString("ru")} ₽`
                  : `Экономия ${offer.savingsRub.toLocaleString("ru")} ₽`}
              </span>
            ) : null}
            {offer.periodBadge ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  isGpt ? "bg-gray-100 text-gray-700" : "bg-white/8 text-white/80",
                )}
              >
                <CalendarDays className="h-3 w-3" aria-hidden />
                {isGpt
                  ? (offer.untilLabel || offer.periodBadge)?.replace(/^До\s+/i, "до ")
                  : offer.untilLabel || offer.periodBadge}
              </span>
            ) : null}
          </div>
        ) : null}

        {offer.monthlyHint ? (
          <p className={cn("text-sm font-medium", isGpt ? "text-gray-600" : "text-white/70")}>
            {offer.monthlyHint}
          </p>
        ) : null}

        {countdown ? (
          <div
            className={cn(
              "inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3 py-2 text-sm font-medium",
              isGpt ? "bg-gray-50 text-gray-700" : "bg-black/30 text-white/80",
            )}
          >
            <Clock3 className="h-4 w-4 shrink-0" style={{ color: accent }} aria-hidden />
            <span>
              {offer.periodBadge ? `${offer.periodBadge} · ` : null}
              {countdown}
            </span>
          </div>
        ) : null}

        {planId ? (
          <ConnectCheckoutButton
            siteSlug={siteSlug}
            planId={planId}
            planName={offer.planName}
            className={cn(
              "shimmer-btn relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90",
              wide && "sm:text-base",
            )}
            style={{
              background: accent,
              boxShadow: isGpt ? "0 4px 16px rgba(16,163,127,0.30)" : "0 4px 20px rgba(29,185,84,0.35)",
            }}
          >
            <span className="relative z-[2] inline-flex items-center justify-center gap-2">
              {isGpt && offer.ctaLabelWide ? (
                <>
                  <span className="sm:hidden">{offer.ctaLabel}</span>
                  <span className="hidden sm:inline">{offer.ctaLabelWide}</span>
                </>
              ) : (
                offer.ctaLabel
              )}
              <ArrowRight size={16} />
            </span>
          </ConnectCheckoutButton>
        ) : (
          <Link
            href={offer.checkoutHref}
            className={cn(
              "shimmer-btn relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90",
              wide && "sm:text-base",
            )}
            style={{
              background: accent,
              boxShadow: isGpt ? "0 4px 16px rgba(16,163,127,0.30)" : "0 4px 20px rgba(29,185,84,0.35)",
            }}
          >
            <span className="relative z-[2] inline-flex items-center justify-center gap-2">
              {isGpt && offer.ctaLabelWide ? (
                <>
                  <span className="sm:hidden">{offer.ctaLabel}</span>
                  <span className="hidden sm:inline">{offer.ctaLabelWide}</span>
                </>
              ) : (
                offer.ctaLabel
              )}
              <ArrowRight size={16} />
            </span>
          </Link>
        )}
      </div>
    </motion.div>
  );
}
