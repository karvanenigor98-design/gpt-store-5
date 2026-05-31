"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { fadeUp } from "@/lib/motion-config";
import type { PublicReview } from "@/lib/reviews/publicReviews";
import { prepareLandingMainReviews } from "@/lib/reviews/landing-reviews-display";
import { shouldHideUsername } from "@/lib/reviews/review-sanitize";

const PREVIEW_COUNT = 4;
const ROTATE_MS = 10_000;

type ReviewsSectionProps = {
  reviews: PublicReview[];
  /** Куда ведёт «Больше отзывов». */
  moreHref?: string;
};

function ReviewCard({ review }: { review: PublicReview }) {
  const username = shouldHideUsername(review.authorUsername)
    ? null
    : review.authorUsername?.replace(/^@+/, "");

  return (
    <article className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-sm">
      <header className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: review.avatarColor }}
        >
          {review.initials}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{review.authorName}</p>
            {review.rating ? (
              <span className="inline-flex text-base leading-none tracking-[0.24em] text-amber-400">
                {"★".repeat(review.rating)}
              </span>
            ) : null}
          </div>
          {username ? <p className="text-xs text-gray-500">@{username}</p> : null}
          <p className="text-xs text-gray-400">{review.dateLabel}</p>
        </div>
      </header>
      <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{review.content}</p>
    </article>
  );
}

export function ReviewsSection({ reviews, moreHref = "/reviews" }: ReviewsSectionProps) {
  const [startIndex, setStartIndex] = useState(0);

  const { pool, averageLabel, count } = useMemo(
    () => prepareLandingMainReviews(reviews.length ? reviews : []),
    [reviews],
  );

  useEffect(() => {
    if (pool.length <= PREVIEW_COUNT) return;
    const id = window.setInterval(() => {
      setStartIndex((i) => (i + PREVIEW_COUNT) % pool.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [pool.length]);

  const previewReviews = useMemo(() => {
    if (pool.length <= PREVIEW_COUNT) return pool;
    const out: PublicReview[] = [];
    for (let i = 0; i < PREVIEW_COUNT; i++) {
      out.push(pool[(startIndex + i) % pool.length]!);
    }
    return out;
  }, [pool, startIndex]);

  const leftCol = previewReviews.filter((_, i) => i % 2 === 0);
  const rightCol = previewReviews.filter((_, i) => i % 2 !== 0);

  if (pool.length === 0) {
    return (
      <section id="reviews" className="px-4 py-20 md:px-6 md:py-28">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
          <h2 className="font-heading text-xl font-bold text-gray-900">Отзывы временно не отображаются</h2>
          <p className="mt-2 text-sm text-gray-600">
            Не удалось загрузить отзывы из Telegram-экспорта. Обновите страницу через минуту.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="reviews" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={fadeUp}
          className="mb-14 flex flex-col items-center gap-3 text-center"
        >
          <span className="inline-flex items-center rounded-full border border-[#10a37f]/20 bg-[#10a37f]/8 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-[#10a37f]">
            Отзывы клиентов
          </span>
          <h2 className="font-heading text-3xl font-bold text-gray-900 md:text-4xl">
            Что говорят пользователи после подключения ChatGPT Plus
          </h2>
          <p className="max-w-2xl text-lg text-gray-500">
            {count} реальных отзывов · средний рейтинг {averageLabel}/5 · сначала самые новые.
          </p>
        </motion.div>

        <div className="hidden items-start gap-6 md:flex">
          <div className="flex flex-1 flex-col gap-6">
            <AnimatePresence mode="popLayout">
              {leftCol.map((review) => (
                <motion.div
                  key={`${review.id}-${startIndex}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                >
                  <ReviewCard review={review} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="mt-10 flex flex-1 flex-col gap-6">
            <AnimatePresence mode="popLayout">
              {rightCol.map((review) => (
                <motion.div
                  key={`${review.id}-${startIndex}-r`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                >
                  <ReviewCard review={review} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:hidden">
          <AnimatePresence mode="wait">
            {previewReviews.map((review) => (
              <motion.div
                key={`${review.id}-${startIndex}-m`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ReviewCard review={review} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href={moreHref}
            className="inline-flex items-center rounded-lg border border-[#10a37f]/25 bg-[#10a37f]/10 px-6 py-2.5 text-sm font-semibold text-[#10a37f] transition-colors hover:bg-[#10a37f]/15"
          >
            Больше отзывов
          </Link>
        </div>
      </div>
    </section>
  );
}
