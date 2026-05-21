"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { SPOTIFY_ACCENT, SPOTIFY_GLOW } from "@/lib/content/spotify";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

export function SpotifyGuarantee() {
  const { guaranteeSection: s } = useSpotifyLanding();
  return (
    <section
      id="guarantee"
      className="px-4 py-20 md:px-6 md:py-28"
      style={{ background: "#0a0a0a" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-4xl"
      >
        <div
          className="rounded-2xl p-6 md:p-10"
          style={{
            background: "rgba(29,185,84,0.06)",
            border: "1px solid rgba(29,185,84,0.2)",
          }}
        >
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{ background: SPOTIFY_GLOW, border: "1px solid rgba(29,185,84,0.25)", color: SPOTIFY_ACCENT }}
          >
            {s.eyebrow}
          </span>
          <ShieldCheck className="mt-4 h-12 w-12" style={{ color: SPOTIFY_ACCENT }} />
          <h2 className="mt-4 font-heading text-3xl font-bold text-white md:text-4xl">
            {s.title}
          </h2>
          <ul className="mt-5 space-y-3">
            {s.points.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span className="mt-1" style={{ color: SPOTIFY_ACCENT }}>
                  •
                </span>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={s.supportTelegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: SPOTIFY_ACCENT, boxShadow: "0 4px 16px rgba(29,185,84,0.3)" }}
            >
              {s.ctaLabel}
            </a>
            <p className="flex items-center text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
              {s.supportHint}
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
