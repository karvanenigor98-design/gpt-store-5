"use client";

import { useEffect, useMemo, useState } from "react";

const DEFAULT_INTERVAL_MS = 10_000;

/** Срез отзывов для лендинга: от startIndex по кругу (новые → старые → снова). */
export function sliceRotatingLandingReviews<T>(
  pool: readonly T[],
  startIndex: number,
  visibleCount: number,
): T[] {
  if (!pool.length) return [];
  const count = Math.min(visibleCount, pool.length);
  return Array.from({ length: count }, (_, i) => pool[(startIndex + i) % pool.length]!);
}

/**
 * Каждые intervalMs сдвигает окно на visibleCount отзывов по отсортированному пулу (новые → старые → цикл).
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
      setStartIndex((prev) => (prev + visibleCount) % pool.length);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [pool.length, visibleCount, intervalMs]);

  return useMemo(
    () => sliceRotatingLandingReviews(pool, startIndex, visibleCount),
    [pool, startIndex, visibleCount],
  );
}
