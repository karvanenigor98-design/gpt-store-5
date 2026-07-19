import type { SpotifyLandingReview } from "@/lib/landing/spotify-landing-types";
import { resolveReviewAuthorDisplay } from "@/lib/reviews/review-author-display";
import { telegramProfileUrl } from "@/lib/reviews/telegram-profile-url";

type Props = {
  review: SpotifyLandingReview;
  showFooter?: boolean;
};

export function SpotifyReviewCard({ review, showFooter = true }: Props) {
  const { displayName, username } = resolveReviewAuthorDisplay({
    authorName: review.authorName,
    authorUsername: review.authorUsername,
    content: review.content,
  });
  const tgUrl = telegramProfileUrl(review.authorUsername, review.sourceUrl);

  return (
    <article
      className="flex h-full min-h-[12.5rem] flex-col rounded-2xl p-5"
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
            <p className="text-sm font-semibold text-white">{displayName}</p>
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
        className="mt-3 line-clamp-5 flex-1 rounded-xl p-3 text-sm leading-relaxed"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.72)",
        }}
      >
        {review.content}
      </p>

      {showFooter && tgUrl && (
        <div className="mt-3">
          <a
            href={tgUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "#1DB954" }}
          >
            Профиль в Telegram
            {username ? ` · @${username}` : ""}
          </a>
        </div>
      )}
    </article>
  );
}
