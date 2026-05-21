"use client";

import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { SPOTIFY_ACCENT, SPOTIFY_GLOW } from "@/lib/content/spotify";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

export function SpotifyRussia() {
  const { russiaSection: s } = useSpotifyLanding();
  return (
    <section
      id="russia"
      className="px-4 py-20 md:px-6 md:py-28"
      style={{ background: "#0a0a0a" }}
    >
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="rounded-2xl p-6 md:p-8"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{ background: SPOTIFY_GLOW, border: "1px solid rgba(29,185,84,0.25)", color: SPOTIFY_ACCENT }}
          >
            {s.eyebrow}
          </span>
          <h2 className="mt-4 font-heading text-2xl font-bold text-white md:text-3xl">
            {s.title}
          </h2>
          <p className="mt-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            {s.subtitle}
          </p>
          <ul className="mt-6 space-y-3">
            {s.points.map((point, i) => (
              <motion.li
                key={point}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="flex items-start gap-3"
              >
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0"
                  style={{ color: SPOTIFY_ACCENT }}
                />
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{point}</span>
              </motion.li>
            ))}
          </ul>
          <p className="mt-6 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
            {s.disclaimer}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
