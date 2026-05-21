"use client";

import { motion } from "framer-motion";
import { SPOTIFY_ACCENT, SPOTIFY_GLOW } from "@/lib/content/spotify";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

export function SpotifyWhySection() {
  const { whySection: s } = useSpotifyLanding();
  return (
    <section
      id="why"
      className="px-4 py-20 md:px-6 md:py-28"
      style={{ background: "#0d0d0d" }}
    >
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mb-14 flex flex-col items-center gap-3 text-center"
        >
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{ background: SPOTIFY_GLOW, border: "1px solid rgba(29,185,84,0.25)", color: SPOTIFY_ACCENT }}
          >
            {s.eyebrow}
          </span>
          <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">
            {s.title}
          </h2>
          <p className="max-w-2xl text-lg" style={{ color: "rgba(255,255,255,0.5)" }}>
            {s.subtitle}
          </p>
        </motion.div>

        <div className="space-y-4">
          {s.points.map((point, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: index * 0.08, duration: 0.5 }}
              className="flex gap-4 rounded-xl p-4 md:p-5"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ background: SPOTIFY_GLOW, color: SPOTIFY_ACCENT, border: "1px solid rgba(29,185,84,0.2)" }}
              >
                {index + 1}
              </span>
              <p className="text-sm leading-relaxed md:text-base" style={{ color: "rgba(255,255,255,0.6)" }}>
                {point}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="mt-6 text-center text-sm"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          {s.footerNote}
        </motion.p>
      </div>
    </section>
  );
}
