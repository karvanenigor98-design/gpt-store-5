"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_INTERVAL_MS = 10_000;

/**
 * Non-wrapping chunk window: unique items only, no wrap-around duplicates in one batch.
 * Tail chunk may be shorter than visibleCount; then cycle back to 0.
 */
export function sliceRotatingLandingReviews<T>(
  pool: readonly T[],
  startIndex: number,
  visibleCount: number,
): T[] {
  if (!pool.length) return [];
  const start = ((startIndex % pool.length) + pool.length) % pool.length;
  const count = Math.min(visibleCount, pool.length - start);
  return pool.slice(start, start + count);
}

/**
 * Every intervalMs advances by visibleCount (chunked). Interval cleared on unmount.
 * When pool.length <= visibleCount, shows all and does not rotate.
 */
export function useLandingReviewsRotation<T>(
  pool: readonly T[],
  visibleCount = 4,
  intervalMs = DEFAULT_INTERVAL_MS,
): T[] {
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    setStartIndex(0);
  }, [pool]);

  useEffect(() => {
    if (pool.length <= visibleCount) return;

    const id = window.setInterval(() => {
      setStartIndex((prev) => {
        const next = prev + visibleCount;
        return next >= pool.length ? 0 : next;
      });
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [pool.length, visibleCount, intervalMs]);

  return useMemo(
    () => sliceRotatingLandingReviews(pool, startIndex, visibleCount),
    [pool, startIndex, visibleCount],
  );
}
