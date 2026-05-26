"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { SPOTIFY_ACCENT, SPOTIFY_GLOW } from "@/lib/content/spotify";
import { useSpotifyLanding } from "@/components/spotify/SpotifyLandingProvider";
import { SpotifyReviewsRotator } from "@/components/spotify/SpotifyReviewsRotator";
import { isSpotifySuitableReview } from "@/lib/reviews/is-spotify-suitable-review";
import { resolveReviewAuthorDisplay } from "@/lib/reviews/review-author-display";

function reviewHeadline(review: {
  authorUsername?: string | null;
  authorName: string;
  content?: string;
}): string {
  const { displayName, username } = resolveReviewAuthorDisplay({
    authorName: review.authorName,
    authorUsername: review.authorUsername,
    content: review.content,
  });
  if (username) return `@${username}`;
  return displayName;
}

export function SpotifyReviews() {
  const { reviews, reviewsSection: sec } = useSpotifyLanding();
  const [featuredTitle, setFeaturedTitle] = useState<string | null>(null);
  const onFeaturedReview = useCallback(
    (review: { authorUsername?: string | null; authorName: string } | null) => {
      setFeaturedTitle(review ? reviewHeadline(review) : null);
    },
    [],
  );

  const published = useMemo(
    () => reviews.filter((r) => isSpotifySuitableReview(r.content)),
    [reviews],
  );

  const avgRating = useMemo(() => {
    const rated = published.filter((r) => r.rating && r.rating > 0);
    if (!rated.length) return null;
    const sum = rated.reduce((acc, r) => acc + (r.rating ?? 0), 0);
    return (sum / rated.length).toFixed(1);
  }, [published]);

  return (
    <section
      id="reviews"
      className="px-4 py-20 md:px-6 md:py-28"
      style={{ background: "#0a0a0a" }}
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
            style={{ background: SPOTIFY_GLOW, border: "1px solid rgba(29,185,84,0.25)", color: SPOTIFY_ACCENT }}
          >
            {sec.eyebrow}
          </span>
          <h2 className="font-heading text-3xl font-bold text-white md:text-4xl">
            {featuredTitle ?? sec.title}
          </h2>
          <p className="max-w-2xl text-lg" style={{ color: "rgba(255,255,255,0.5)" }}>
            {sec.subtitle}
          </p>
          {avgRating && (
            <p className="text-sm font-medium" style={{ color: SPOTIFY_ACCENT }}>
              Средняя оценка {avgRating} / 5 · {published.length} отзывов
            </p>
          )}
        </motion.div>

        <div className="mx-auto max-w-3xl">
          <SpotifyReviewsRotator reviews={published} onFeaturedReview={onFeaturedReview} />
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl justify-center">
          <Link
            href="/spotify/reviews"
            className="inline-flex items-center rounded-xl px-6 py-2.5 text-sm font-semibold transition-all hover:opacity-90"
            style={{
              background: "rgba(29,185,84,0.12)",
              border: "1px solid rgba(29,185,84,0.3)",
              color: SPOTIFY_ACCENT,
            }}
          >
            Больше отзывов
          </Link>
        </div>
      </div>
    </section>
  );
}
