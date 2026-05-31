"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clock3, Lock, ShieldCheck, type LucideIcon } from "lucide-react";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { scrollToSpotifyPricing } from "@/lib/spotify/scroll-to-pricing";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

const TRUST_ICONS: LucideIcon[] = [Lock, Clock3, ShieldCheck];

export function SpotifyFinalCta() {
  const { finalCtaSection: s } = useSpotifyLanding();
  const trustItems = s.trustLines.map((text, i) => ({
    icon: TRUST_ICONS[i % TRUST_ICONS.length],
    text,
  }));
  return (
    <section
      id="final-cta"
      className="relative overflow-hidden py-16 md:py-28"
      style={{ background: "#0a0a0a" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(29,185,84,0.08) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="relative z-10 mx-auto max-w-4xl px-4 text-center"
      >
        <span
          className="mb-4 inline-block text-xs font-semibold uppercase tracking-widest"
          style={{ color: SPOTIFY_ACCENT }}
        >
          {s.eyebrow}
        </span>
        <h2 className="font-heading text-3xl font-bold text-white md:text-5xl">
          {s.title}
        </h2>
        <p className="mt-4 text-base md:text-lg" style={{ color: "rgba(255,255,255,0.5)" }}>
          {s.subtitle}
        </p>

        <div className="mt-10">
          <motion.button
            type="button"
            onClick={scrollToSpotifyPricing}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-base font-semibold text-white shadow-lg md:px-10 md:py-5 md:text-xl"
            style={{
              background: SPOTIFY_ACCENT,
              boxShadow: "0 4px 30px rgba(29,185,84,0.4)",
            }}
          >
            {s.buttonLabel}
            <ArrowRight size={20} />
          </motion.button>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 md:gap-8">
          {trustItems.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              <Icon size={12} />
              {text}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
