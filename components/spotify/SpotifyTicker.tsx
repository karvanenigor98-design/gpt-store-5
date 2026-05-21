"use client";

import { motion } from "framer-motion";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";

export function SpotifyTicker() {
  const { tickerItems } = useSpotifyLanding();
  const repeated = [...tickerItems, ...tickerItems, ...tickerItems];

  return (
    <div
      className="relative overflow-hidden py-3.5"
      style={{
        background: "rgba(29,185,84,0.06)",
        borderTop: "1px solid rgba(29,185,84,0.15)",
        borderBottom: "1px solid rgba(29,185,84,0.15)",
      }}
    >
      <div
        className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-24"
        style={{ background: "linear-gradient(to right, #0a0a0a, transparent)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-24"
        style={{ background: "linear-gradient(to left, #0a0a0a, transparent)" }}
      />
      <motion.div
        className="flex gap-12 whitespace-nowrap"
        animate={{ x: ["0%", "-33.33%"] }}
        transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
      >
        {repeated.map((item, i) => (
          <span
            key={i}
            className="inline-flex shrink-0 items-center gap-3 text-sm font-medium"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {item}
            <span
              className="h-1 w-1 shrink-0 rounded-full"
              style={{ background: SPOTIFY_ACCENT, opacity: 0.5 }}
            />
          </span>
        ))}
      </motion.div>
    </div>
  );
}
