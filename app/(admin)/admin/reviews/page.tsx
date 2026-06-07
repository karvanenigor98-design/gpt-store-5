import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReviewModerationActions } from "./ReviewModerationActions";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";
import { listAccessibleAdminSiteSlugs } from "@/lib/admin/subs-api-guard";
import { createSubsStoreAdminClient, isSubsStoreBackendConfigured } from "@/lib/supabase/subs-store-admin";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { formatReviewAuthorLikeAdmin } from "@/lib/reviews/admin-display-review";
import {
  loadGptAdminReviews,
  loadSubsAdminReviews,
  type AdminReviewRow,
} from "@/lib/reviews/load-admin-reviews";
import { AdminOrdersLiveRefresh } from "@/components/admin/AdminOrdersLiveRefresh";

export const metadata: Metadata = { title: "Admin · Отзывы" };

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; site?: string }>;
}) {
  const { status: statusParam = "pending", site: siteParam } = await searchParams;
  const status =
    statusParam === "approved" || statusParam === "rejected" ? statusParam : "pending";
  const siteSlug = resolveAdminSiteSlug({ site: siteParam });
  const site = getSiteBySlug(siteSlug);
  await requireAdminPage();

  let reviews: AdminReviewRow[] = [];
  let setupHint: string | null = null;

  if (siteSlug === "subs-store") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login");
    }
    const gptAdmin = createAdminClient();
    const accessible = await listAccessibleAdminSiteSlugs(user, gptAdmin);
    if (!accessible.includes("subs-store")) {
      redirect("/admin/reviews");
    }

    if (!isSubsStoreBackendConfigured()) {
      setupHint =
        "Подключите Subs Store: задайте SUBS_SUPABASE_URL и SUBS_SUPABASE_SERVICE_ROLE_KEY в .env.local";
    } else if (!createSubsStoreAdminClient()) {
      setupHint = "Не удалось подключиться к Supabase Subs Store — проверьте ключи.";
    } else {
      reviews = await loadSubsAdminReviews(status);
    }
  } else {
    reviews = await loadGptAdminReviews("gpt-store", status);
  }

  return (
    <div className="p-6">
      <AdminOrdersLiveRefresh siteSlug={siteSlug} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-gray-900">
          Отзывы
          <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
            {site.brandName}
          </span>
        </h1>
        <div className="flex flex-wrap gap-2">
          {["pending", "approved", "rejected"].map((s) => (
            <a
              key={s}
              href={`/admin/reviews?status=${s}&site=${siteSlug}`}
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
          <strong>Subs Store</strong>, чтобы их видеть здесь.
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
