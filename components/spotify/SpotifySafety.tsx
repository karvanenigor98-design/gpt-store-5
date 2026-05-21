"use client";

import { motion } from "framer-motion";
import { Check, Shield, X } from "lucide-react";
import { SPOTIFY_ACCENT, SPOTIFY_GLOW } from "@/lib/content/spotify";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";
import { spotifySafetyPrincipleIcon } from "@/components/spotify/spotify-landing-icons";

const cardBg = "rgba(255,255,255,0.04)";
const cardBorder = "rgba(255,255,255,0.08)";

export function SpotifySafety() {
  const { safetySection: s } = useSpotifyLanding();
  return (
    <section
      id="safety"
      className="px-4 py-20 md:px-6 md:py-28"
      style={{ background: "#0d0d0d" }}
    >
      <div className="mx-auto max-w-6xl">
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
          <div
            className="flex items-center justify-center rounded-2xl p-3"
            style={{ background: SPOTIFY_GLOW }}
          >
            <Shield className="h-8 w-8" style={{ color: SPOTIFY_ACCENT }} />
          </div>
          <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">
            {s.title}
          </h2>
          <p className="max-w-2xl text-lg" style={{ color: "rgba(255,255,255,0.5)" }}>
            {s.subtitle}
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <p
              className="mb-5 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {s.mythsTitle}
            </p>
            <ul className="space-y-3">
              {s.myths.map((item, i) => (
                <motion.li
                  key={item.myth}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5 }}
                >
                  <motion.div
                    className="cursor-default overflow-hidden rounded-xl p-5"
                    style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                    whileHover={{ borderColor: "rgba(29,185,84,0.3)" }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <X size={14} className="shrink-0 text-red-400" />
                      <span className="text-sm line-through" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {item.myth}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check size={14} className="shrink-0" style={{ color: SPOTIFY_ACCENT }} />
                      <span className="text-sm font-medium" style={{ color: SPOTIFY_ACCENT }}>
                        {item.fact}
                      </span>
                    </div>
                  </motion.div>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            <div
              className="rounded-2xl p-6"
              style={{
                background: cardBg,
                border: `1px solid rgba(29,185,84,0.2)`,
              }}
            >
              <h3 className="mb-5 font-heading text-lg font-semibold text-white">
                {s.principlesTitle}
              </h3>
              <ul className="space-y-4">
                {s.principles.map((principle) => {
                  const Icon = spotifySafetyPrincipleIcon(principle.iconKey);
                  return (
                    <li key={principle.text} className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: SPOTIFY_GLOW }}
                      >
                        <Icon className="h-4 w-4" style={{ color: SPOTIFY_ACCENT }} />
                      </span>
                      <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                        {principle.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div
                className="mt-6 rounded-xl px-4 py-3 text-sm font-medium"
                style={{
                  background: "rgba(29,185,84,0.1)",
                  border: "1px solid rgba(29,185,84,0.2)",
                  color: SPOTIFY_ACCENT,
                }}
              >
                {s.footerNote}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
