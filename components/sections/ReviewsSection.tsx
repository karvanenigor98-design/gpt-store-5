"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { fadeUp } from "@/lib/motion-config";
import type { PublicReview } from "@/lib/reviews/publicReviews";
import { sortPublicReviewsNewestFirst, shouldHideUsername } from "@/lib/reviews/review-sanitize";

const PREVIEW_COUNT = 4;
const EXPAND_CHUNK = 60;
const ROTATE_MS = 10_000;

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

export function ReviewsSection({ reviews }: { reviews: PublicReview[] }) {
  const [expanded, setExpanded] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const [expandedVisible, setExpandedVisible] = useState(EXPAND_CHUNK);

  const pool = useMemo(
    () => (reviews.length ? sortPublicReviewsNewestFirst(reviews) : []),
    [reviews],
  );

  useEffect(() => {
    if (expanded || pool.length <= PREVIEW_COUNT) return;
    const id = window.setInterval(() => {
      setStartIndex((i) => (i + PREVIEW_COUNT) % pool.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [expanded, pool.length]);

  useEffect(() => {
    if (expanded) setExpandedVisible(EXPAND_CHUNK);
  }, [expanded]);

  const previewReviews = useMemo(() => {
    if (pool.length <= PREVIEW_COUNT) return pool;
    const out: PublicReview[] = [];
    for (let i = 0; i < PREVIEW_COUNT; i++) {
      out.push(pool[(startIndex + i) % pool.length]!);
    }
    return out;
  }, [pool, startIndex]);

  const expandedList = useMemo(
    () => pool.slice(0, expandedVisible),
    [pool, expandedVisible],
  );

  const leftCol = previewReviews.filter((_, i) => i % 2 === 0);
  const rightCol = previewReviews.filter((_, i) => i % 2 !== 0);
  const hasMore = pool.length > PREVIEW_COUNT;
  const canLoadMore = expanded && expandedVisible < pool.length;

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
            Что говорят клиенты
          </h2>
          <p className="max-w-2xl text-lg text-gray-500">
            {pool.length} реальных отзывов из Telegram — сначала самые новые.
          </p>
        </motion.div>

        {!expanded ? (
          <>
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
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-sm text-gray-500">
              Показано {expandedList.length} из {pool.length}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {expandedList.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {hasMore && !expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="inline-flex items-center rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Показать все {pool.length} отзывов
            </button>
          ) : null}
          {expanded ? (
            <>
              {canLoadMore ? (
                <button
                  type="button"
                  onClick={() => setExpandedVisible((n) => Math.min(n + EXPAND_CHUNK, pool.length))}
                  className="inline-flex items-center rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                >
                  Ещё {Math.min(EXPAND_CHUNK, pool.length - expandedVisible)} отзывов
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex items-center rounded-lg border border-black/10 px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100"
              >
                Свернуть
              </button>
            </>
          ) : null}
          <Link
            href="/reviews"
            className="inline-flex items-center rounded-lg border border-[#10a37f]/20 px-4 py-2 text-sm font-medium text-[#10a37f] transition-colors hover:bg-[#10a37f]/5"
          >
            Открыть на отдельной странице
          </Link>
        </div>
      </div>
    </section>
  );
}
