"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Pause, Play } from "lucide-react";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { ConnectCheckoutButton } from "@/components/checkout/ConnectCheckoutButton";
import { cn } from "@/lib/utils";

const WAVE_BARS = [36, 62, 48, 78, 42, 88, 55, 70, 46, 82, 38, 66, 52, 74, 58];

function MusicVisual({
  playing,
  spacious,
  wide,
  reduceMotion,
}: {
  playing: boolean;
  spacious?: boolean;
  wide?: boolean;
  reduceMotion: boolean | null;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full items-end overflow-hidden rounded-xl px-3 py-3",
        wide ? "h-24 sm:h-28" : spacious ? "h-24" : "h-20",
      )}
      style={{
        background: "linear-gradient(180deg, rgba(29,185,84,0.1) 0%, rgba(29,185,84,0.02) 100%)",
        border: "1px solid rgba(29,185,84,0.18)",
      }}
    >
      <div
        className={cn(
          "relative flex h-full w-full items-end",
          wide ? "justify-between gap-1.5 sm:gap-2" : "justify-center gap-1.5",
        )}
      >
        {WAVE_BARS.map((h, i) => (
          <motion.div
            key={i}
            className={cn(
              "origin-bottom rounded-full",
              wide ? "max-w-[14px] flex-1 sm:max-w-[16px]" : spacious ? "w-2.5 sm:w-3" : "w-2",
            )}
            style={{ background: SPOTIFY_ACCENT, height: `${h}%`, opacity: 0.7 + (i % 3) * 0.1 }}
            animate={
              playing && !reduceMotion
                ? { scaleY: [1, 1.35, 0.7, 1.2, 1] }
                : { scaleY: 1 }
            }
            transition={
              playing && !reduceMotion
                ? {
                    duration: 1.1 + (i % 4) * 0.25,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut",
                    delay: i * 0.06,
                  }
                : { duration: 0.2 }
            }
          />
        ))}
      </div>
    </div>
  );
}

export type SpotifyPromoPlayerCardProps = {
  badge: string;
  title: string;
  subtitle: string;
  fromLabel: string;
  priceRub: number;
  featureChips: string[];
  ctaLabel?: string;
  planId: string | null;
  planName?: string | null;
  variant?: "glass" | "solid";
  size?: "default" | "large" | "wide";
  className?: string;
};

export function SpotifyPromoPlayerCard({
  badge,
  title,
  subtitle,
  fromLabel,
  priceRub,
  featureChips,
  ctaLabel,
  planId,
  planName,
  variant = "solid",
  size = "default",
  className,
}: SpotifyPromoPlayerCardProps) {
  const wide = size === "wide";
  const spacious = size === "large" || wide;
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => setPlaying(false);
  }, []);

  const shellStyle =
    variant === "glass"
      ? {
          background:
            "linear-gradient(155deg, rgba(22,28,23,0.94) 0%, rgba(10,12,11,0.97) 55%, rgba(14,18,15,0.95) 100%)",
          border: "1px solid rgba(29,185,84,0.24)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 0 40px rgba(29,185,84,0.1)",
        }
      : {
          background: "linear-gradient(160deg, #141914 0%, #0a0c0a 55%, #121512 100%)",
          border: "1px solid rgba(29,185,84,0.2)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 36px rgba(29,185,84,0.1)",
        };

  return (
    <div
      className={cn(
        "relative mx-auto w-full overflow-hidden",
        wide
          ? "max-w-none rounded-3xl p-5 sm:p-7 md:p-8"
          : spacious
            ? "max-w-md rounded-3xl p-5 sm:max-w-lg sm:p-7"
            : "max-w-full rounded-2xl p-5",
        className,
      )}
      style={shellStyle}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 110% 70% at 15% -10%, rgba(29,185,84,0.16) 0%, transparent 55%)",
        }}
      />

      <div className="relative flex flex-col">
        <div className="mb-4">
          <p
            className={cn(
              "font-heading font-bold uppercase tracking-[0.16em]",
              spacious ? "text-sm" : "text-xs",
            )}
            style={{ color: SPOTIFY_ACCENT }}
          >
            {badge || "SPOTIFY STORE"}
          </p>
          <h3
            className={cn(
              "mt-1.5 font-heading font-bold text-white",
              spacious ? "text-2xl sm:text-[1.65rem]" : "text-xl",
            )}
          >
            {title}
          </h3>
          <p
            className={cn("mt-1", spacious ? "text-sm" : "text-sm")}
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {subtitle}
          </p>
        </div>

        <div className="relative">
          <MusicVisual
            playing={playing}
            spacious={spacious}
            wide={wide}
            reduceMotion={reduceMotion}
          />
          <button
            type="button"
            onClick={() => setPlaying((v) => !v)}
            className={cn(
              "absolute bottom-3 right-3 flex items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              spacious ? "h-11 w-11" : "h-10 w-10",
            )}
            style={{
              background: SPOTIFY_ACCENT,
              boxShadow: "0 0 18px rgba(29,185,84,0.45)",
              outlineColor: SPOTIFY_ACCENT,
            }}
            aria-label={playing ? "Остановить анимацию" : "Запустить анимацию"}
            aria-pressed={playing}
          >
            {playing ? (
              <Pause className="h-4 w-4" fill="white" aria-hidden />
            ) : (
              <Play className="ml-0.5 h-4 w-4" fill="white" aria-hidden />
            )}
          </button>
        </div>

        <div className={cn("mt-5 flex items-end justify-between gap-3", spacious && "mt-6")}>
          <div>
            <p
              className="text-[11px] font-medium uppercase tracking-[0.14em]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {fromLabel}
            </p>
            <p className={cn("mt-0.5 font-heading font-bold leading-none text-white", spacious ? "text-4xl" : "text-3xl")}>
              {priceRub.toLocaleString("ru")}
              <span className={cn("ml-1 font-semibold", spacious ? "text-2xl" : "text-xl")} style={{ color: SPOTIFY_ACCENT }}>
                ₽
              </span>
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: "rgba(29,185,84,0.12)",
              border: "1px solid rgba(29,185,84,0.28)",
              color: SPOTIFY_ACCENT,
            }}
          >
            Premium
          </span>
        </div>

        <ul className={cn("mt-4 flex flex-wrap gap-2", spacious && "mt-5")}>
          {featureChips.map((f) => (
            <li
              key={f}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full font-medium",
                spacious ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs",
              )}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.78)",
              }}
            >
              <Check className="h-3.5 w-3.5 shrink-0" style={{ color: SPOTIFY_ACCENT }} aria-hidden />
              {f}
            </li>
          ))}
        </ul>

        {ctaLabel && planId ? (
          <ConnectCheckoutButton
            siteSlug="subs-store"
            planId={planId}
            planName={planName}
            trackSource="hero_promo_card"
            className={cn(
              "mt-5 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl font-semibold text-white transition-opacity hover:opacity-90",
              spacious ? "mt-6 py-3.5 text-base" : "py-3 text-sm",
            )}
            style={{ background: SPOTIFY_ACCENT, boxShadow: "0 8px 28px rgba(29,185,84,0.35)" }}
          >
            {ctaLabel}
            <ArrowRight size={spacious ? 18 : 15} />
          </ConnectCheckoutButton>
        ) : ctaLabel ? (
          <a
            href="#pricing"
            className={cn(
              "mt-5 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl font-semibold text-white transition-opacity hover:opacity-90",
              spacious ? "mt-6 py-3.5 text-base" : "py-3 text-sm",
            )}
            style={{ background: SPOTIFY_ACCENT, boxShadow: "0 8px 28px rgba(29,185,84,0.35)" }}
          >
            {ctaLabel}
            <ArrowRight size={spacious ? 18 : 15} />
          </a>
        ) : null}
      </div>
    </div>
  );
}
