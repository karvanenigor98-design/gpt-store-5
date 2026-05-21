"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { fadeUp } from "@/lib/motion-config";
import { getSubsStoreLandingPath } from "@/lib/store-urls";

const SPOTIFY_LOGO_PATH =
  "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z";

/** Баннер Subs Store на лендинге GPT STORE — зеркало SpotifyGptCrossSell на /spotify. */
export function CrossSellSection() {
  const subsHref = getSubsStoreLandingPath();

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={fadeUp}
      className="mx-auto mt-8 flex w-full max-w-3xl flex-col items-start justify-between gap-5 rounded-2xl border border-black/[0.08] bg-gray-50 p-5 text-left sm:flex-row sm:items-center sm:p-6"
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(29,185,84,0.1)", border: "1px solid rgba(29,185,84,0.2)" }}
        >
          <svg viewBox="0 0 24 24" fill={SPOTIFY_ACCENT} className="h-7 w-7" aria-hidden>
            <path d={SPOTIFY_LOGO_PATH} />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Также от GPT STORE</p>
          <h3 className="font-heading text-lg font-bold text-gray-900">Spotify Premium</h3>
          <p className="text-sm text-gray-500">
            Подписка Spotify с оплатой в рублях, поддержкой и активацией за 10–15 минут.
          </p>
        </div>
      </div>
      <Link
        href={subsHref}
        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
        style={{ background: SPOTIFY_ACCENT }}
      >
        Перейти в Subs Store
        <ArrowRight size={15} />
      </Link>
    </motion.div>
  );
}
