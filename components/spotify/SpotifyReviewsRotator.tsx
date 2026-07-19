"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { SpotifyReviewCard } from "@/components/spotify/SpotifyReviewCard";
import { useLandingReviewsRotation } from "@/hooks/useLandingReviewsRotation";
import type { SpotifyLandingReview } from "@/lib/landing/spotify-landing-types";
import { cn } from "@/lib/utils";

const ROTATION_MS = 10_000;

type Props = {
  reviews: SpotifyLandingReview[];
  onFeaturedReview?: (review: SpotifyLandingReview | null) => void;
};

function useResponsiveVisibleCount(): number {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const mqXl = window.matchMedia("(min-width: 1280px)");
    const mqMd = window.matchMedia("(min-width: 768px)");

    const apply = () => {
      if (mqXl.matches) setCount(4);
      else if (mqMd.matches) setCount(2);
      else setCount(1);
    };

    apply();
    mqXl.addEventListener("change", apply);
    mqMd.addEventListener("change", apply);
    return () => {
      mqXl.removeEventListener("change", apply);
      mqMd.removeEventListener("change", apply);
    };
  }, []);

  return count;
}

export function SpotifyReviewsRotator({ reviews, onFeaturedReview }: Props) {
  const reduceMotion = useReducedMotion();
  const visibleCount = useResponsiveVisibleCount();

  const pool = useMemo(
    () =>
      reviews.filter(
        (r) =>
          r.content.trim().length >= 12 &&
          !/\bбот\b/i.test(r.content) &&
          !/\bbot\b/i.test(r.content),
      ),
    [reviews],
  );

  const visible = useLandingReviewsRotation(pool, visibleCount, ROTATION_MS);
  const batchKey = visible.map((r) => r.id).join("|");

  useEffect(() => {
    onFeaturedReview?.(visible[0] ?? null);
  }, [visible, onFeaturedReview]);

  if (!visible.length) {
    return (
      <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
        Отзывы скоро появятся
      </p>
    );
  }

  const gridClass =
    visibleCount >= 4
      ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      : visibleCount >= 2
        ? "grid grid-cols-1 gap-4 md:grid-cols-2"
        : "grid grid-cols-1 gap-4";

  return (
    <div
      className={cn(
        "relative w-full",
        visibleCount >= 4 ? "min-h-[20rem]" : visibleCount >= 2 ? "min-h-[22rem]" : "min-h-[14rem]",
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={batchKey}
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={
            reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
          }
          className={gridClass}
        >
          {visible.map((review) => (
            <SpotifyReviewCard key={review.id} review={review} />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
