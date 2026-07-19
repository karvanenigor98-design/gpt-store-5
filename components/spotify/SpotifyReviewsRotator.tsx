"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { SpotifyReviewCard } from "@/components/spotify/SpotifyReviewCard";
import { useLandingReviewsRotation } from "@/hooks/useLandingReviewsRotation";
import type { SpotifyLandingReview } from "@/lib/landing/spotify-landing-types";

const VISIBLE_COUNT = 4;
const ROTATION_MS = 10_000;

type Props = {
  reviews: SpotifyLandingReview[];
  onFeaturedReview?: (review: SpotifyLandingReview | null) => void;
};

export function SpotifyReviewsRotator({ reviews, onFeaturedReview }: Props) {
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

  const visible = useLandingReviewsRotation(pool, VISIBLE_COUNT, ROTATION_MS);
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

  return (
    <div className="relative min-h-[28rem]">
      <AnimatePresence mode="wait">
        <motion.div
          key={batchKey}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-4"
        >
          {visible.map((review) => (
            <SpotifyReviewCard key={review.id} review={review} />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
