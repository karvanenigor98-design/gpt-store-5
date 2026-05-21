import Link from "next/link";

import type { SpotifyLandingReview } from "@/lib/landing/spotify-landing-types";

type Props = {
  review: SpotifyLandingReview;
  showFooter?: boolean;
};

export function SpotifyReviewCard({ review, showFooter = true }: Props) {
  const username = review.authorUsername?.replace(/^@+/, "");
  const profileHref = review.inSiteProfileUrl ?? "/spotify/reviews";

  return (
    <article
      className="rounded-2xl p-5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <header className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: review.avatarColor }}
        >
          {review.initials}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{review.authorName}</p>
            {review.rating > 0 && (
              <span className="inline-flex text-base leading-none tracking-[0.24em] text-amber-400">
                {"★".repeat(review.rating)}
              </span>
            )}
          </div>
          {username && (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
              @{username}
            </p>
          )}
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            {[review.tariff, review.dateLabel].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      <p
        className="mt-3 rounded-xl p-3 text-sm leading-relaxed"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.72)",
        }}
      >
        {review.content}
      </p>

      {showFooter && (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
          <Link
            href={profileHref}
            className="transition-colors hover:text-white"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Профиль на сайте
          </Link>
          {review.sourceUrl && (
            <a
              href={review.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-opacity hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              Источник в Telegram
            </a>
          )}
        </div>
      )}
    </article>
  );
}
