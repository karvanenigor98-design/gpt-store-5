"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { cn } from "@/lib/utils";

const SPOTIFY_LOGO_PATH =
  "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z";

function MusicVisual({ spacious, wide }: { spacious?: boolean; wide?: boolean }) {
  const bars = [40, 70, 55, 85, 45, 90, 60, 75, 50, 80, 35, 65, 48, 72, 58];
  return (
    <div
      className={cn(
        "relative flex w-full items-end",
        wide ? "h-28 justify-between gap-1.5 sm:h-32 sm:gap-2" : spacious ? "h-28 justify-center gap-1 sm:h-32 md:h-36" : "h-24 justify-center gap-1",
      )}
    >
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className={cn(
            "rounded-full",
            wide ? "max-w-[14px] flex-1 sm:max-w-[18px]" : spacious ? "w-2.5 sm:w-3" : "w-2",
          )}
          style={{ background: SPOTIFY_ACCENT, height: `${h}%`, opacity: 0.7 + (i % 3) * 0.1 }}
          animate={{ scaleY: [1, 1.4, 0.7, 1.2, 1] }}
          transition={{
            duration: 1.2 + (i % 4) * 0.3,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            delay: i * 0.1,
          }}
        />
      ))}
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
      <p className={spacious ? "text-sm" : "text-xs"} style={{ color: "rgba(255,255,255,0.5)" }}>
        {fromLabel}
      </p>
      <p className={cn("font-bold text-white", spacious ? "text-3xl sm:text-4xl" : "text-2xl")}>
        {priceRub.toLocaleString("ru")}{" "}
        <span className={spacious ? "text-xl sm:text-2xl" : "text-lg"} style={{ color: SPOTIFY_ACCENT }}>
          ₽
        </span>
      </p>
    </div>
  );
}

function PlayButton({
  href,
  onClick,
  spacious,
  className,
  ariaLabel,
}: {
  href: string;
  onClick: (e: React.MouseEvent) => void;
  spacious?: boolean;
  className?: string;
  ariaLabel: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95",
        spacious ? "h-12 w-12 sm:h-14 sm:w-14" : "h-10 w-10",
        className,
      )}
      style={{ background: SPOTIFY_ACCENT, boxShadow: "0 0 20px rgba(29,185,84,0.4)" }}
      aria-label={ariaLabel}
    >
      <svg
        viewBox="0 0 24 24"
        fill="white"
        className={cn("ml-0.5", spacious ? "h-6 w-6 sm:h-7 sm:w-7" : "h-5 w-5")}
        aria-hidden
      >
        <path d="M8 5v14l11-7z" />
      </svg>
    </Link>
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
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(29,185,84,0.1)",
        }
      : {
          background: "linear-gradient(160deg, #141414 0%, #0a0a0a 55%, #121212 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35), 0 0 40px rgba(29,185,84,0.12)",
        };
  const handlePlayClick = (e: React.MouseEvent) => {
    if (!scrollToId) return;
    e.preventDefault();
    document.getElementById(scrollToId)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      className={cn(
        "relative mx-auto w-full overflow-hidden rounded-2xl",
        wide
          ? "max-w-none rounded-3xl p-6 sm:p-8 md:p-10"
          : spacious
            ? "max-w-md rounded-3xl p-6 sm:max-w-lg sm:p-8 md:max-w-xl"
            : "max-w-xs rounded-2xl p-5",
        className,
      )}
      style={shellStyle}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(29,185,84,0.14) 0%, transparent 60%)",
        }}
      />

      <div className={cn("relative", wide && "md:grid md:grid-cols-[minmax(0,1fr)_11rem] md:gap-x-10 lg:grid-cols-[minmax(0,1fr)_13rem]")}>
        <div className={cn(wide && "md:col-start-1")}>
          <div className={cn("flex items-center gap-3", spacious ? "mb-6 gap-4" : "mb-5")}>
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-xl",
                spacious ? "h-14 w-14 sm:h-16 sm:w-16" : "h-12 w-12",
              )}
              style={{ background: "rgba(29,185,84,0.2)", border: "1px solid rgba(29,185,84,0.35)" }}
            >
              <svg
                viewBox="0 0 24 24"
                fill={SPOTIFY_ACCENT}
                className={spacious ? "h-8 w-8 sm:h-9 sm:w-9" : "h-7 w-7"}
                aria-hidden
              >
                <path d={SPOTIFY_LOGO_PATH} />
              </svg>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p
                className={cn(
                  "font-semibold uppercase tracking-wider",
                  spacious ? "text-xs sm:text-sm" : "text-xs",
                )}
                style={{ color: SPOTIFY_ACCENT }}
              >
                {badge}
              </p>
              <p className={cn("font-bold text-white", spacious ? "text-base sm:text-lg" : "text-sm", !wide && "truncate")}>
                {title}
              </p>
              <p
                className={spacious ? "text-sm sm:text-base" : "text-xs"}
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                {subtitle}
              </p>
            </div>
          </div>

          <MusicVisual spacious={spacious} wide={wide} />

          {wide && (
            <div className="mt-6 flex items-center justify-between md:hidden">
              <PriceBlock fromLabel={fromLabel} priceRub={priceRub} spacious={spacious} />
              <PlayButton
                href={href}
                onClick={handlePlayClick}
                spacious={spacious}
                ariaLabel={ctaLabel ?? "Перейти в SPOTIFY STORE"}
              />
            </div>
          )}

          {!wide && (
            <div className={cn("flex items-center justify-between", spacious ? "mt-6 sm:mt-7" : "mt-5")}>
              <PriceBlock fromLabel={fromLabel} priceRub={priceRub} spacious={spacious} />
              <PlayButton
                href={href}
                onClick={handlePlayClick}
                spacious={spacious}
                ariaLabel={ctaLabel ?? "Перейти в SPOTIFY STORE"}
              />
            </div>
          )}

          <div
            className={cn(
              "flex flex-wrap gap-2",
              wide ? "mt-5 justify-start sm:mt-6" : "justify-center",
              spacious && !wide ? "mt-5 gap-2.5 sm:mt-6" : !spacious ? "mt-4 justify-center" : "",
            )}
          >
            {featureChips.map((f) => (
              <span
                key={f}
                className={cn(
                  "rounded-lg text-center font-medium",
                  spacious ? "px-3 py-2 text-sm sm:px-3.5 sm:py-2.5" : "px-2 py-1.5 text-xs",
                )}
                style={{
                  background: "rgba(29,185,84,0.1)",
                  border: "1px solid rgba(29,185,84,0.2)",
                  color: SPOTIFY_ACCENT,
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {wide && (
          <div className="hidden md:col-start-2 md:row-span-2 md:flex md:flex-col md:items-stretch md:justify-center md:border-l md:border-white/10 md:pl-8 lg:pl-10">
            <PriceBlock fromLabel={fromLabel} priceRub={priceRub} spacious className="md:text-right" />
            <PlayButton
              href={href}
              onClick={handlePlayClick}
              spacious
              className="md:mt-6 md:self-end"
              ariaLabel={ctaLabel ?? "Перейти в Subs Store"}
            />
          </div>
        )}

        {ctaLabel ? (
          <Link
            href={href}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition-opacity hover:opacity-90",
              wide ? "col-span-1 mt-6 py-3.5 text-base sm:mt-8 sm:py-4 sm:text-lg md:col-span-2" : spacious
                ? "mt-6 py-3.5 text-base sm:mt-7 sm:py-4 sm:text-lg"
                : "mt-5 py-2.5 text-sm",
            )}
            style={{ background: SPOTIFY_ACCENT }}
          >
            {ctaLabel}
            <ArrowRight size={spacious ? 18 : 15} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
