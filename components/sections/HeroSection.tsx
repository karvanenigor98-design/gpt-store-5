"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { HERO_CONTENT } from "@/lib/chatgpt-data";
import { HeroPromoOfferCard } from "@/components/landing/HeroPromoOfferCard";

export function HeroSection() {
  const { scrollY } = useScroll();
  const bgY = useTransform(scrollY, [0, 500], [0, 80]);
  const contentY = useTransform(scrollY, [0, 500], [0, 40]);
  const opacity = useTransform(scrollY, [0, 350], [1, 0]);

  return (
    <section
      id="hero"
      className="relative flex min-h-[calc(100dvh-3.5rem)] items-center overflow-hidden px-4 py-14 md:min-h-screen md:px-6 md:py-20"
    >
      <motion.div className="pointer-events-none absolute inset-0" style={{ y: bgY }}>
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 75% 55% at 50% 20%, rgba(16,163,127,0.07) 0%, transparent 68%),
              radial-gradient(ellipse 50% 40% at 85% 90%, rgba(96,124,196,0.06) 0%, transparent 58%),
              rgba(255,255,255,0.22)
            `,
          }}
        />
      </motion.div>

      <motion.div className="relative z-10 w-full" style={{ y: contentY, opacity }}>
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-2 md:gap-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-center md:text-left"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#10a37f]/20 bg-[#10a37f]/[0.07] px-4 py-2 text-sm text-[#10a37f]"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#10a37f]" />
              {HERO_CONTENT.badge}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="font-heading font-bold leading-tight tracking-tight text-gray-900"
            >
              <span className="block text-4xl md:text-5xl lg:text-6xl">{HERO_CONTENT.title}</span>
              <span
                className="block text-4xl md:text-5xl lg:text-6xl"
                style={{
                  background: "linear-gradient(135deg, #10a37f 0%, #1a56db 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {HERO_CONTENT.accentTitle}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-5 max-w-xl text-sm text-gray-500 md:mx-0 md:text-lg"
            >
              {HERO_CONTENT.subtitle}
            </motion.p>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-6 flex flex-wrap justify-center gap-2 md:justify-start md:gap-2.5"
            >
              {HERO_CONTENT.trustBadges.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.07 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10a37f]" />
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
              <HeroPromoOfferCard site="gpt" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-7 flex w-full flex-col items-center gap-3 md:items-start sm:w-auto sm:flex-row sm:gap-4"
            >
              <motion.a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                whileHover={{ scale: 1.03, boxShadow: "0 6px 24px rgba(16,163,127,0.40)" }}
                whileTap={{ scale: 0.98 }}
                className="shimmer-btn relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 py-3.5 text-sm font-semibold text-white transition-shadow sm:w-auto sm:px-8 sm:py-4 sm:text-base"
                style={{
                  background: "#10a37f",
                  boxShadow: "0 4px 16px rgba(16,163,127,0.30)",
                }}
              >
                <span className="relative z-[2] inline-flex items-center justify-center gap-2">
                  {HERO_CONTENT.primaryCta}
                  <ArrowRight size={17} />
                </span>
              </motion.a>
              <a
                href="#how-it-works"
                className="text-sm text-gray-400 transition-colors hover:text-gray-700"
              >
                {HERO_CONTENT.secondaryCta} →
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-3 text-xs text-gray-400 md:mt-4 md:text-sm"
            >
              {HERO_CONTENT.meta}
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="hidden md:block"
          >
            <HeroPromoOfferCard site="gpt" layout="wide" />
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
