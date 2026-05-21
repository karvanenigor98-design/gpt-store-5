"use client";

import { motion } from "framer-motion";
import { SPOTIFY_ACCENT, SPOTIFY_GLOW } from "@/lib/content/spotify";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";
import { spotifyHowItWorksIcon } from "@/components/spotify/spotify-landing-icons";

const sectionBg = "#0a0a0a";
const cardBg = "rgba(255,255,255,0.04)";
const cardBorder = "rgba(255,255,255,0.08)";

export function SpotifyHowItWorks() {
  const { howItWorksSection: s } = useSpotifyLanding();
  return (
    <section
      id="how-it-works"
      className="px-4 py-20 md:px-6 md:py-28"
      style={{ background: sectionBg }}
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
            style={{
              background: SPOTIFY_GLOW,
              border: `1px solid rgba(29,185,84,0.25)`,
              color: SPOTIFY_ACCENT,
            }}
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

        <div className="grid gap-6 md:grid-cols-4">
          {s.steps.map((step, index) => {
            const Icon = spotifyHowItWorksIcon(step.iconKey);
            return (
              <motion.article
                key={`${step.title}-${index}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="relative rounded-2xl p-6"
                style={{
                  background: cardBg,
                  border: `1px solid ${cardBorder}`,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                }}
              >
                <span
                  className="absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: SPOTIFY_ACCENT }}
                >
                  {index + 1}
                </span>
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{
                    background: SPOTIFY_GLOW,
                    border: `1px solid rgba(29,185,84,0.2)`,
                  }}
                >
                  <Icon size={22} color={SPOTIFY_ACCENT} />
                </div>
                <h3 className="font-heading text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {step.description}
                </p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
