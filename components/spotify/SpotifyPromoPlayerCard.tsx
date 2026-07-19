"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { cn } from "@/lib/utils";

function MusicVisual({ spacious, wide }: { spacious?: boolean; wide?: boolean }) {
  const bars = [40, 70, 55, 85, 45, 90, 60, 75, 50, 80, 35, 65, 48, 72, 58];
  return (
    <div
      className={cn(
        "relative flex w-full items-end overflow-hidden rounded-xl px-3 py-3",
        wide ? "h-28 sm:h-32" : spacious ? "h-24 sm:h-28" : "h-20",
      )}
      style={{
        background: "linear-gradient(180deg, rgba(29,185,84,0.08) 0%, rgba(29,185,84,0.02) 100%)",
        border: "1px solid rgba(29,185,84,0.16)",
      }}
    >
      <div
        className={cn(
          "relative flex h-full w-full items-end",
          wide ? "justify-between gap-1.5 sm:gap-2" : "justify-center gap-1.5",
        )}
      >
        {bars.map((h, i) => (
          <motion.div
            key={i}
            className={cn(
              "rounded-full",
              wide ? "max-w-[14px] flex-1 sm:max-w-[16px]" : spacious ? "w-2.5 sm:w-3" : "w-2",
            )}
            style={{ background: SPOTIFY_ACCENT, height: `${h}%`, opacity: 0.65 + (i % 3) * 0.12 }}
            animate={{ scaleY: [1, 1.35, 0.75, 1.15, 1] }}
            transition={{
              duration: 1.2 + (i % 4) * 0.3,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
              delay: i * 0.08,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PriceBlock({
  fromLabel,
  priceRub,
  spacious,
  className,
}: {
  fromLabel: string;
  priceRub: number;
  spacious?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("text-left", className)}>
      <p
        className={cn("font-medium uppercase tracking-[0.14em]", spacious ? "text-xs" : "text-[11px]")}
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
  );
}

export type SpotifyPromoPlayerCardProps = {
  badge: string;
  title: string;
  subtitle: string;
  fromLabel: string;
  priceRub: number;
  featureChips: string[];
  href: string;
  ctaLabel?: string;
  scrollToId?: string;
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
  href,
  ctaLabel,
  scrollToId,
  variant = "solid",
  size = "default",
  className,
}: SpotifyPromoPlayerCardProps) {
  const wide = size === "wide";
  const spacious = size === "large" || wide;
  const shellStyle =
    variant === "glass"
      ? {
          background: "linear-gradient(155deg, rgba(22,28,23,0.92) 0%, rgba(10,12,11,0.96) 55%, rgba(14,18,15,0.94) 100%)",
          border: "1px solid rgba(29,185,84,0.22)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 0 48px rgba(29,185,84,0.12)",
        }
      : {
          background: "linear-gradient(160deg, #141914 0%, #0a0c0a 55%, #121512 100%)",
          border: "1px solid rgba(29,185,84,0.2)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(29,185,84,0.1)",
        };

  const handleCtaClick = (e: React.MouseEvent) => {
    if (!scrollToId) return;
    e.preventDefault();
    document.getElementById(scrollToId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className={cn(
        "relative mx-auto w-full overflow-hidden",
        wide
          ? "max-w-none rounded-3xl p-6 sm:p-8 md:p-9"
          : spacious
            ? "max-w-md rounded-3xl p-6 sm:max-w-lg sm:p-8"
            : "max-w-xs rounded-2xl p-5",
        className,
      )}
      style={shellStyle}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 110% 70% at 20% -10%, rgba(29,185,84,0.18) 0%, transparent 55%), radial-gradient(ellipse 80% 50% at 100% 100%, rgba(29,185,84,0.08) 0%, transparent 50%)",
        }}
      />

      <div
        className={cn(
          "relative",
          wide && "md:grid md:grid-cols-[minmax(0,1fr)_12rem] md:items-stretch md:gap-x-8 lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-x-10",
        )}
      >
        <div className={cn(wide && "md:col-start-1 md:flex md:min-h-0 md:flex-col")}>
          {/* Brand header — text mark, no Spotify glyph */}
          <div className={cn("mb-5", spacious && "mb-6")}>
            <p
              className={cn(
                "font-heading font-bold uppercase tracking-[0.16em]",
                spacious ? "text-sm sm:text-base" : "text-xs",
              )}
              style={{ color: SPOTIFY_ACCENT }}
            >
              {badge || "SPOTIFY STORE"}
            </p>
            <h3
              className={cn(
                "mt-1.5 font-heading font-bold text-white",
                spacious ? "text-2xl sm:text-3xl" : "text-xl",
              )}
            >
              {title}
            </h3>
            <p
              className={cn("mt-1", spacious ? "text-sm sm:text-base" : "text-sm")}
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {subtitle}
            </p>
          </div>

          <MusicVisual spacious={spacious} wide={wide} />

          {!wide && (
            <div className={cn("flex items-end justify-between", spacious ? "mt-6" : "mt-5")}>
              <PriceBlock fromLabel={fromLabel} priceRub={priceRub} spacious={spacious} />
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
          )}

          <ul
            className={cn(
              "flex flex-wrap gap-2",
              wide ? "mt-5 justify-start sm:mt-6" : "mt-4 justify-start",
              spacious && !wide && "mt-5 sm:mt-6",
            )}
          >
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
        </div>

        {wide && (
          <div
            className="mt-6 flex items-center justify-between border-t border-white/10 pt-5 md:mt-0 md:flex-col md:items-end md:justify-center md:border-l md:border-t-0 md:pl-8 md:pt-0 lg:pl-10"
          >
            <PriceBlock fromLabel={fromLabel} priceRub={priceRub} spacious className="md:text-right" />
            <p
              className="mt-0 text-xs font-medium md:mt-4"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Оплата в рублях
            </p>
          </div>
        )}

        {ctaLabel ? (
          <Link
            href={href}
            onClick={handleCtaClick}
            className={cn(
              "relative z-[1] flex w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition-opacity hover:opacity-90",
              wide
                ? "col-span-1 mt-6 py-3.5 text-base sm:mt-8 sm:py-4 sm:text-lg md:col-span-2"
                : spacious
                  ? "mt-6 py-3.5 text-base sm:mt-7 sm:py-4"
                  : "mt-5 py-3 text-sm",
            )}
            style={{ background: SPOTIFY_ACCENT, boxShadow: "0 8px 28px rgba(29,185,84,0.35)" }}
          >
            {ctaLabel}
            <ArrowRight size={spacious ? 18 : 15} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
