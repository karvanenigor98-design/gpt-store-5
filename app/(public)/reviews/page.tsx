import type { Metadata } from "next";
import Link from "next/link";

import { LandingFooter } from "@/components/layout/LandingFooter";
import { getStaticGptLandingReviews } from "@/lib/landing/gpt-static-landing";
import { resolveSearchParams } from "@/lib/next-search-params";
import { loadGptTelegramCuratedReviews } from "@/lib/reviews/load-gpt-telegram-curated";
import type { PublicReview } from "@/lib/reviews/publicReviews";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Отзывы клиентов",
  description: "Реальные отзывы клиентов из Telegram и профилей на сайте.",
};

const REVIEWS_PAGE_SIZE = 80;
/** Лимит загрузки на SSR (Vercel serverless); пагинация по 80 на странице. */
const REVIEWS_FETCH_LIMIT = 240;

function loadReviewsSafe(limit: number): PublicReview[] {
  try {
    const curated = loadGptTelegramCuratedReviews(limit);
    if (curated.length >= 8) return curated;
  } catch (err) {
    console.error("[reviews] curated load failed:", err);
  }
  return getStaticGptLandingReviews(limit);
}

export default async function PublicReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ author?: string; page?: string }> | { author?: string; page?: string };
}) {
  const { author, page: pageRaw } = await resolveSearchParams(searchParams);
  const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);

  const reviews = loadReviewsSafe(REVIEWS_FETCH_LIMIT);

  const authorFilter = author?.trim().toLowerCase();

  const filteredReviews = authorFilter
    ? reviews.filter((item) => {
        const username = item.authorUsername?.replace(/^@+/, "").toLowerCase() ?? "";
        const name = item.authorName.toLowerCase();
        return username === authorFilter || name === authorFilter;
      })
    : reviews;

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / REVIEWS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageReviews = filteredReviews.slice(
    (safePage - 1) * REVIEWS_PAGE_SIZE,
    safePage * REVIEWS_PAGE_SIZE,
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex h-14 items-center border-b border-black/[0.06] px-6">
        <Link href="/" className="font-heading text-sm font-semibold text-gray-900 hover:text-[#10a37f]">
          GPT STORE
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-bold text-gray-900">Отзывы клиентов</h1>
            <p className="mt-2 text-sm text-gray-500">
              Публикуем только реальные отзывы. Можно проверить источник и перейти в профиль.
            </p>
          </div>
          {authorFilter && (
            <Link href="/reviews" className="text-sm text-[#10a37f] hover:underline">
              Сбросить фильтр
            </Link>
          )}
        </div>

        {!authorFilter && filteredReviews.length > REVIEWS_PAGE_SIZE && (
          <p className="mb-4 text-sm text-gray-500">
            Показано {(safePage - 1) * REVIEWS_PAGE_SIZE + 1}–
            {Math.min(safePage * REVIEWS_PAGE_SIZE, filteredReviews.length)} из {filteredReviews.length}
          </p>
        )}

        <div className="space-y-4">
          {pageReviews.map((review) => (
            <article key={review.id} className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ backgroundColor: review.avatarColor }}
                  >
                    {review.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{review.authorName}</p>
                      {review.rating != null && review.rating > 0 && (
                        <span className="inline-flex text-base leading-none tracking-[0.24em] text-amber-400">
                          {"★".repeat(Math.min(5, Math.round(review.rating)))}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">{review.dateLabel}</p>
                  </div>
                </div>
              </div>

              <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">{review.content}</p>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                {review.authorUsername && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                    @{review.authorUsername.replace(/^@+/, "")}
                  </span>
                )}
                {review.sourceUrl && (
                  <a
                    href={review.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#10a37f] hover:underline"
                  >
                    Открыть источник в Telegram
                  </a>
                )}
                <Link href={review.inSiteProfileUrl} className="text-gray-500 hover:text-gray-700 hover:underline">
                  Профиль на сайте
                </Link>
              </div>
            </article>
          ))}
        </div>

        {filteredReviews.length === 0 && (
          <div className="rounded-2xl border border-black/[0.07] bg-white p-6 text-center text-sm text-gray-500">
            {authorFilter
              ? "По этому профилю пока нет опубликованных отзывов."
              : "Отзывы временно недоступны. Обновите страницу через минуту."}
          </div>
        )}

        {!authorFilter && totalPages > 1 && (
          <nav className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {safePage > 1 && (
              <Link
                href={`/reviews?page=${safePage - 1}`}
                className="rounded-lg border border-black/[0.08] px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                ← Назад
              </Link>
            )}
            <span className="text-sm text-gray-500">
              Страница {safePage} из {totalPages}
            </span>
            {safePage < totalPages && (
              <Link
                href={`/reviews?page=${safePage + 1}`}
                className="rounded-lg border border-black/[0.08] px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Далее →
              </Link>
            )}
          </nav>
        )}
      </main>

      <LandingFooter />
    </div>
  );
}
