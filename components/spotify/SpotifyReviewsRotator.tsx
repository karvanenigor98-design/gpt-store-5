"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { SpotifyReviewCard } from "@/components/spotify/SpotifyReviewCard";
import type { SpotifyLandingReview } from "@/lib/landing/spotify-landing-types";

const VISIBLE_COUNT = 4;
const ROTATE_MS = 10_000;

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

  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (pool.length <= VISIBLE_COUNT) return;
    const timer = window.setInterval(() => {
      setOffset((prev) => (prev + VISIBLE_COUNT) % pool.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [pool.length]);

  const visible = useMemo(() => {
    if (!pool.length) return [];
    const count = Math.min(VISIBLE_COUNT, pool.length);
    const items: SpotifyLandingReview[] = [];
    for (let i = 0; i < count; i += 1) {
      items.push(pool[(offset + i) % pool.length]);
    }
    return items;
  }, [pool, offset]);

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
      <AnimatePresence mode="popLayout">
        {visible.map((review) => (
          <motion.div
            key={`${review.id}-${offset}`}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            <SpotifyReviewCard review={review} />
          </motion.div>
        ))}
      </AnimatePresence>
      {pool.length > VISIBLE_COUNT && (
        <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          Показываем 4 из {pool.length} · обновление каждые 10 сек
        </p>
      )}
    </div>
  );
}
