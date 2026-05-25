import type { Metadata } from "next";
import Link from "next/link";

import { SpotifyReviewCard } from "@/components/spotify/SpotifyReviewCard";
import { SpotifyFooter } from "@/components/spotify/SpotifyFooter";
import { SpotifyNav } from "@/components/spotify/SpotifyNav";
import { SpotifyLandingProvider } from "@/components/spotify/SpotifyLandingProvider";
import { SPOTIFY_ACCENT } from "@/lib/content/spotify";
import { getSpotifyLandingPageData } from "@/lib/landing/get-spotify-landing-payload";
import { isSpotifySuitableReview } from "@/lib/reviews/is-spotify-suitable-review";
import { getSpotifyPublicReviews } from "@/lib/reviews/spotifyPublicReviews";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Отзывы клиентов — SPOTIFY STORE",
  description: "Реальные отзывы клиентов SPOTIFY STORE о подключении Spotify Premium.",
};

export default async function SpotifyPublicReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ author?: string }>;
}) {
  const { author } = await searchParams;
  const [{ payload }, reviews] = await Promise.all([
    getSpotifyLandingPageData(),
    getSpotifyPublicReviews(200),
  ]);

  const authorFilter = author?.trim().toLowerCase();
  const filteredReviews = authorFilter
    ? reviews.filter((item) => {
        const username = item.authorUsername?.replace(/^@+/, "").toLowerCase() ?? "";
        const name = item.authorName.toLowerCase();
        return username === authorFilter || name === authorFilter;
      })
    : reviews.filter((r) => isSpotifySuitableReview(r.content));

  return (
    <SpotifyLandingProvider payload={payload}>
      <div className="flex min-h-screen flex-col" style={{ background: "#0a0a0a" }}>
        <SpotifyNav />

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-20 md:px-6">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                href="/spotify#reviews"
                className="text-sm transition-colors hover:text-white"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                ← На лендинг
              </Link>
              <h1 className="font-heading mt-3 text-3xl font-bold text-white">Отзывы клиентов</h1>
              <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                Реальные отзывы о Spotify Premium. Можно проверить источник и перейти в профиль.
              </p>
            </div>
            {authorFilter && (
              <Link href="/spotify/reviews" className="text-sm hover:underline" style={{ color: SPOTIFY_ACCENT }}>
                Сбросить фильтр
              </Link>
            )}
          </div>

          <div className="space-y-4">
            {filteredReviews.map((review) => (
              <SpotifyReviewCard key={review.id} review={review} />
            ))}
          </div>

          {filteredReviews.length === 0 && (
            <div
              className="rounded-2xl p-6 text-center text-sm"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              По этому профилю пока нет опубликованных отзывов.
            </div>
          )}
        </main>

        <SpotifyFooter />
      </div>
    </SpotifyLandingProvider>
  );
}
