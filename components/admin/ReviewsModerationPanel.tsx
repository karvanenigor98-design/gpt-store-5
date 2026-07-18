import { AdminOrdersLiveRefresh } from "@/components/admin/AdminOrdersLiveRefresh";
import { ReviewModerationActions } from "@/app/(admin)/admin/reviews/ReviewModerationActions";
import { formatReviewAuthorLikeAdmin } from "@/lib/reviews/admin-display-review";
import type { AdminReviewRow } from "@/lib/reviews/load-admin-reviews";

type ListStatus = "pending" | "approved" | "rejected";

export function ReviewsModerationPanel(props: {
  staffRoot: "/admin" | "/operator";
  siteSlug: "gpt-store" | "subs-store";
  brandName: string;
  primaryColor: string;
  status: ListStatus;
  reviews: AdminReviewRow[];
  setupHint?: string | null;
  canDelete: boolean;
}) {
  const {
    staffRoot,
    siteSlug,
    brandName,
    primaryColor,
    status,
    reviews,
    setupHint,
    canDelete,
  } = props;

  return (
    <div className="p-6">
      <AdminOrdersLiveRefresh siteSlug={siteSlug} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-gray-900">
          Отзывы
          <span className="ml-3 text-base font-normal" style={{ color: primaryColor }}>
            {brandName}
          </span>
        </h1>
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <a
              key={s}
              href={`${staffRoot}/reviews?status=${s}&site=${siteSlug}`}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                status === s ? "bg-[#10a37f]/10 text-[#0f7d62]" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {s === "pending" ? "На модерации" : s === "approved" ? "Опубликованы" : "Отклонены"}
            </a>
          ))}
        </div>
      </div>

      {siteSlug === "subs-store" && (
        <p className="mb-4 text-xs text-gray-500">
          Отзывы из кабинета Subs Store сохраняются в базе Subs. Переключите магазин в шапке на{" "}
          <strong>SPOTIFY STORE</strong>, чтобы их видеть здесь.
        </p>
      )}

      {setupHint ? (
        <p className="max-w-xl text-sm text-gray-600">{setupHint}</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const { authorName, authorUsername } = formatReviewAuthorLikeAdmin({
              authorName: review.author_name,
              authorUsername: review.author_username,
            });
            return (
              <div key={review.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {authorName}
                      {authorUsername && (
                        <span className="ml-2 text-xs text-gray-500">@{authorUsername}</span>
                      )}
                      {review.rating != null && (
                        <span className="ml-2 text-amber-500">{"★".repeat(review.rating)}</span>
                      )}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">{review.content}</p>
                    {review.telegram_date && (
                      <p className="mt-1 text-xs text-gray-600">
                        {new Date(review.telegram_date).toLocaleString("ru-RU")}
                      </p>
                    )}
                  </div>
                  <ReviewModerationActions
                    reviewId={review.id}
                    siteSlug={siteSlug}
                    listStatus={status}
                    initialRating={review.rating}
                    canDelete={canDelete}
                  />
                </div>
              </div>
            );
          })}
          {reviews.length === 0 && (
            <p className="text-sm text-gray-500">
              {status === "pending"
                ? "Новых отзывов на модерации нет. Отзывы из кабинета клиента появятся здесь сразу после отправки."
                : "В этом разделе пока нет отзывов"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
