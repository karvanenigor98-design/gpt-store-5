"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { scrollToSpotifyPricing } from "@/lib/spotify/scroll-to-pricing";
import { HeroPromoOfferCard } from "@/components/landing/HeroPromoOfferCard";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

export function SpotifyHero() {
  const { hero } = useSpotifyLanding();
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 500], [0, 80]);
  const contentY = useTransform(scrollY, [0, 500], [0, 30]);
  const opacityVal = useTransform(scrollY, [0, 400], [1, 0]);

  return (
    <section
      id="hero"
      className="relative flex min-h-[calc(100dvh-3.5rem)] items-center overflow-hidden px-4 py-14 md:px-6 md:py-20"
      style={{ background: "#0a0a0a" }}
    >
      <motion.div className="pointer-events-none absolute inset-0" style={{ y: bgY }}>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 55% at 50% 0%, rgba(29,185,84,0.12) 0%, transparent 65%),
              radial-gradient(ellipse 45% 35% at 90% 90%, rgba(29,185,84,0.05) 0%, transparent 55%)
            `,
          }}
        />
      </motion.div>

      <motion.div className="relative z-10 w-full" style={{ y: contentY, opacity: opacityVal }}>
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="mb-6 inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wider shadow-lg"
              style={{
                background: "linear-gradient(135deg, rgba(29,185,84,0.18) 0%, rgba(29,185,84,0.08) 100%)",
                border: "1px solid rgba(29,185,84,0.35)",
                color: SPOTIFY_ACCENT,
                boxShadow: "0 0 24px rgba(29,185,84,0.15)",
              }}
            >
              <span
                className="h-2 w-2 animate-pulse rounded-full"
                style={{ background: SPOTIFY_ACCENT }}
              />
              {hero.badge}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="font-heading font-bold leading-tight tracking-tight"
            >
              <span className="block text-4xl text-white md:text-5xl lg:text-6xl">
                {hero.title}
              </span>
              <span
                className="block text-4xl md:text-5xl lg:text-6xl"
                style={{
                  background: `linear-gradient(135deg, ${SPOTIFY_ACCENT} 0%, #17a549 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {hero.accentTitle}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-5 max-w-xl text-sm md:text-lg"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              {hero.subtitle}
            </motion.p>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-6 flex flex-wrap gap-2"
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
              className="mt-6 md:hidden"
            >
              <HeroPromoOfferCard site="spotify" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4"
            >
              <motion.button
                type="button"
                onClick={scrollToSpotifyPricing}
                whileHover={{ scale: 1.03, boxShadow: "0 6px 30px rgba(29,185,84,0.45)" }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white sm:w-auto sm:px-8 sm:py-4 sm:text-base"
                style={{
                  background: SPOTIFY_ACCENT,
                  boxShadow: "0 4px 20px rgba(29,185,84,0.35)",
                }}
              >
                {hero.primaryCta}
                <ArrowRight size={17} />
              </motion.button>
              <a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSpotifyPricing();
                }}
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
              className="mt-3 text-xs md:mt-4"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {hero.meta}
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="hidden md:block"
          >
            <HeroPromoOfferCard site="spotify" layout="wide" />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
