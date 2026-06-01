"use client";

import { useState } from "react";
import { Check, Trash2, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type ListStatus = "pending" | "approved" | "rejected";

export function ReviewModerationActions({
  reviewId,
  siteSlug = "gpt-store",
  listStatus = "pending",
  initialRating = null,
}: {
  reviewId: string;
  siteSlug?: string;
  listStatus?: ListStatus;
  initialRating?: number | null;
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | "delete" | null>(null);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function callApi(action: "approve" | "reject" | "delete", approveRating?: number) {
    const api =
      siteSlug === "subs-store" ? "/api/admin/subs-store/reviews" : "/api/admin/reviews";
    const res = await fetch(api, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        id: reviewId,
        action,
        site: siteSlug,
        ...(action === "approve" && approveRating != null ? { rating: approveRating } : {}),
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? "Ошибка");
    }
  }

  async function moderate(action: "approve" | "reject") {
    setError(null);
    if (action === "approve" && (rating == null || rating < 1)) {
      setError("Перед публикацией выберите рейтинг.");
      return;
    }
    setLoading(action);
    try {
      await callApi(action, action === "approve" ? rating ?? undefined : undefined);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(null);
    }
  }

  async function removePublished() {
    if (
      !window.confirm(
        "Удалить отзыв? Он исчезнет с лендинга и из списка опубликованных.",
      )
    ) {
      return;
    }
    setLoading("delete");
    try {
      await callApi("delete");
      router.refresh();
    } catch {
      /* noop */
    } finally {
      setLoading(null);
    }
  }

  if (listStatus !== "pending") {
    return (
      <button
        type="button"
        onClick={() => void removePublished()}
        disabled={!!loading}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
        title="Удалить с сайта"
      >
        {loading === "delete" ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Trash2 size={13} />
        )}
        Удалить
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {rating == null && (
        <div className="flex items-center gap-1" title="Рейтинг для публикации">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className="text-lg leading-none text-amber-400 hover:scale-110"
              aria-label={`${n} звёзд`}
            >
              ★
            </button>
          ))}
        </div>
      )}
      {rating != null && (
        <p className="text-xs text-amber-600">
          Рейтинг: {"★".repeat(rating)}
          <button
            type="button"
            className="ml-2 text-gray-400 underline"
            onClick={() => setRating(null)}
          >
            изменить
          </button>
        </p>
      )}
      {error && <p className="max-w-[12rem] text-right text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void moderate("approve")}
          disabled={!!loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-900/30 text-green-400 hover:bg-green-900/50 disabled:opacity-50"
          title="Одобрить"
        >
          {loading === "approve" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button
          type="button"
          onClick={() => void moderate("reject")}
          disabled={!!loading}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 disabled:opacity-50"
          title="Отклонить"
        >
          {loading === "reject" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
        </button>
      </div>
    </div>
  );
}
