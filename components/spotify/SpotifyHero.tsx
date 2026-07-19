"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  SPOTIFY_ACCENT,
  SPOTIFY_HERO_ACCENT_BASE,
  SPOTIFY_HERO_ACCENT_WITH_TIMING,
  SPOTIFY_HERO_BADGE_NO_TIMING,
  SPOTIFY_HERO_BADGE_WITH_TIMING,
} from "@/lib/content/spotify";
import { scrollToSpotifyPricing } from "@/lib/spotify/scroll-to-pricing";
import { resolveHeroCheckoutPlan } from "@/lib/spotify/resolve-hero-checkout-plan";
import { reachLandingGoal } from "@/lib/analytics/reach-landing-goal";
import { useLandingHeroAb } from "@/lib/analytics/landing-hero-ab";
import { SpotifyPromoPlayerCard } from "@/components/spotify/SpotifyPromoPlayerCard";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

function scrollToSpotifyPricingFromHero(source: string): void {
  reachLandingGoal("landing_hero_cta_click", { site: "subs-store", source });
  reachLandingGoal("landing_scroll_to_pricing", { site: "subs-store", source });
  scrollToSpotifyPricing();
}

export function SpotifyHero() {
  const { hero, heroPlayerPreview, plans } = useSpotifyLanding();
  const heroAb = useLandingHeroAb("subs-store");
  const badge = heroAb === "h1" ? SPOTIFY_HERO_BADGE_NO_TIMING : SPOTIFY_HERO_BADGE_WITH_TIMING;
  const accentTitle =
    heroAb === "h1" ? SPOTIFY_HERO_ACCENT_WITH_TIMING : SPOTIFY_HERO_ACCENT_BASE;
  const player = heroPlayerPreview;
  const checkoutPlan = useMemo(() => resolveHeroCheckoutPlan(plans), [plans]);

  const cardProps = {
    badge: player.cardBadge,
    title: player.cardTitle,
    subtitle: player.cardSubtitle,
    fromLabel: player.fromLabel,
    priceRub: player.priceRub,
    featureChips: player.featureChips,
    ctaLabel: hero.primaryCta,
    planId: checkoutPlan?.id ?? null,
    planName: checkoutPlan?.name ?? null,
    variant: "glass" as const,
  };

  return (
    <section
      id="hero"
      className="relative flex min-h-0 items-start overflow-x-hidden px-4 py-8 md:min-h-[min(720px,calc(100dvh-3.5rem))] md:items-center md:px-6 md:py-14 lg:py-16"
      style={{ background: "#0a0a0a" }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 55% at 50% 0%, rgba(29,185,84,0.12) 0%, transparent 65%),
              radial-gradient(ellipse 45% 35% at 90% 90%, rgba(29,185,84,0.05) 0%, transparent 55%)
            `,
          }}
        />
      </div>

      <div className="relative z-10 w-full">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-6 md:grid-cols-2 md:items-center md:gap-8 lg:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="mb-4 inline-flex max-w-full items-center gap-2.5 rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-wider shadow-lg sm:px-4 sm:text-xs md:mb-5"
              style={{
                background: "linear-gradient(135deg, rgba(29,185,84,0.18) 0%, rgba(29,185,84,0.08) 100%)",
                border: "1px solid rgba(29,185,84,0.35)",
                color: SPOTIFY_ACCENT,
                boxShadow: "0 0 24px rgba(29,185,84,0.15)",
              }}
            >
              <span
                className="h-2 w-2 shrink-0 animate-pulse rounded-full"
                style={{ background: SPOTIFY_ACCENT }}
              />
              <span className="truncate">{badge}</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="font-heading font-bold leading-tight tracking-tight"
            >
              <span className="block text-3xl text-white md:text-4xl lg:text-5xl xl:text-6xl">
                {hero.title}
              </span>
              <span
                className="block text-3xl md:text-4xl lg:text-5xl xl:text-6xl"
                style={{
                  background: `linear-gradient(135deg, ${SPOTIFY_ACCENT} 0%, #17a549 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {accentTitle}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-4 max-w-xl text-sm md:mt-5 md:text-base lg:text-lg"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              {hero.subtitle}
            </motion.p>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-4 flex flex-wrap gap-2 md:mt-5"
            >
              {hero.trustBadges.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.07 }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: SPOTIFY_ACCENT }} />
                  {item}
                </motion.li>
              ))}
            </motion.ul>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
              className="mt-5 md:hidden"
            >
              <SpotifyPromoPlayerCard {...cardProps} size="default" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.48, duration: 0.6 }}
              className="mt-5 flex w-full flex-col gap-3 md:hidden"
            >
              <motion.button
                type="button"
                onClick={() => scrollToSpotifyPricingFromHero("hero_mobile")}
                whileTap={{ scale: 0.98 }}
                className="shimmer-btn relative inline-flex min-h-[44px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3.5 text-sm font-semibold text-white"
                style={{
                  background: SPOTIFY_ACCENT,
                  boxShadow: "0 4px 20px rgba(29,185,84,0.35)",
                }}
              >
                {hero.primaryCta}
                <ArrowRight size={17} />
              </motion.button>
              <a
                href="#how-it-works"
                className="text-sm transition-colors"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {hero.secondaryCta} →
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-6 hidden w-full flex-col gap-3 md:flex sm:w-auto sm:flex-row sm:items-center sm:gap-4"
            >
              <motion.button
                type="button"
                onClick={() => scrollToSpotifyPricingFromHero("hero_desktop")}
                whileHover={{ scale: 1.03, boxShadow: "0 6px 30px rgba(29,185,84,0.45)" }}
                whileTap={{ scale: 0.98 }}
                className="shimmer-btn relative inline-flex min-h-[44px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3.5 text-sm font-semibold text-white sm:w-auto sm:px-8 sm:py-4 sm:text-base"
                style={{
                  background: SPOTIFY_ACCENT,
                  boxShadow: "0 4px 20px rgba(29,185,84,0.35)",
                }}
              >
                <span className="relative z-[2] inline-flex items-center justify-center gap-2">
                  {hero.primaryCta}
                  <ArrowRight size={17} />
                </span>
              </motion.button>
              <a
                href="#how-it-works"
                className="text-sm transition-colors"
                style={{ color: "rgba(255,255,255,0.4)" }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.color = "rgba(255,255,255,0.8)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.color = "rgba(255,255,255,0.4)";
                }}
              >
                {hero.secondaryCta} →
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-3 hidden text-xs sm:block md:mt-4"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {hero.meta}
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="hidden min-w-0 md:block"
          >
            <SpotifyPromoPlayerCard {...cardProps} size="wide" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
