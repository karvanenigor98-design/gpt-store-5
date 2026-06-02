"use client";

import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";

import { SpotifyReviewCard } from "@/components/spotify/SpotifyReviewCard";
import type { SpotifyLandingReview } from "@/lib/landing/spotify-landing-types";

const VISIBLE_COUNT = 4;

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

  const visible = useMemo(() => {
    if (!pool.length) return [];
    return pool.slice(0, VISIBLE_COUNT);
  }, [pool]);

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
    <div className="space-y-4">
      {visible.map((review) => (
        <motion.div
          key={review.id}
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <SpotifyReviewCard review={review} />
        </motion.div>
      ))}
    </div>
  );
}
