"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { HERO_CONTENT } from "@/lib/chatgpt-data";
import { fadeIn, fadeUp, staggerContainer, staggerFast } from "@/lib/motion-config";
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
      {/* Градиент-фон с параллаксом */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ y: bgY }}
      >
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


      {/* Контент */}
      <motion.div className="relative z-10 w-full" style={{ y: contentY, opacity }}>
        <motion.div
          initial={false}
          animate="visible"
          variants={staggerContainer}
          className="mx-auto flex w-full max-w-4xl flex-col items-center text-center"
        >
          {/* Badge */}
          <motion.div
            variants={fadeIn}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#10a37f]/20 bg-[#10a37f]/[0.07] px-4 py-2 text-sm text-[#10a37f]"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#10a37f]" />
            {HERO_CONTENT.badge}
          </motion.div>

          {/* H1 */}
          <motion.h1 variants={fadeUp} className="font-heading font-bold leading-tight tracking-tight text-gray-900">
            <span className="block text-4xl md:hidden">{HERO_CONTENT.title}</span>
            <span
              className="block text-4xl md:hidden"
              style={{
                background: "linear-gradient(135deg, #10a37f 0%, #1a56db 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {HERO_CONTENT.accentTitle}
            </span>

            <span className="hidden md:block md:text-6xl lg:text-7xl">{HERO_CONTENT.title}</span>
            <span
              className="hidden md:block md:text-6xl lg:text-7xl"
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

          {/* Subtitle */}
          <motion.p variants={fadeUp} className="mt-5 max-w-xl text-sm text-gray-500 md:mt-6 md:max-w-2xl md:text-lg">
            {HERO_CONTENT.subtitle}
          </motion.p>

          {/* Trust badges */}
          <motion.ul variants={staggerFast} className="mt-6 flex flex-wrap justify-center gap-2 md:gap-2.5">
            {HERO_CONTENT.trustBadges.map((item) => (
              <motion.li
                key={item}
                variants={fadeUp}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-white px-3 py-1.5 text-sm text-gray-600 shadow-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#10a37f]" />
                {item}
              </motion.li>
            ))}
          </motion.ul>

          <motion.div variants={fadeUp} className="mt-6 w-full max-w-md md:max-w-xl lg:max-w-2xl">
            <HeroPromoOfferCard site="gpt" />
          </motion.div>

          {/* CTA */}
          <motion.div variants={fadeUp} className="mt-7 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
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

          <motion.p variants={fadeIn} className="mt-3 text-xs text-gray-400 md:mt-4 md:text-sm">
            {HERO_CONTENT.meta}
          </motion.p>

          {/* Scroll indicator */}
          <motion.div variants={fadeIn} className="mt-16 hidden flex-col items-center gap-2.5 md:flex">
            <motion.div
              className="relative flex h-11 w-7 items-start justify-center rounded-full border-2 p-1.5"
              style={{
                borderColor: "rgba(16,163,127,0.5)",
                boxShadow: "0 0 16px rgba(16,163,127,0.18), inset 0 0 8px rgba(16,163,127,0.06)",
              }}
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                className="h-2 w-1 rounded-full"
                style={{ background: "linear-gradient(180deg, #10a37f 0%, #1a56db 100%)" }}
                animate={{ y: [0, 14, 0], opacity: [1, 0.2, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
            <div className="flex flex-col items-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: i === 0 ? 4 : i === 1 ? 3 : 2,
                    height: i === 0 ? 4 : i === 1 ? 3 : 2,
                    background: i === 0 ? "#10a37f" : i === 1 ? "rgba(16,163,127,0.6)" : "rgba(16,163,127,0.3)",
                  }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}


