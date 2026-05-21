"use client";

import { useState } from "react";
import { Check, Trash2, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type ListStatus = "pending" | "approved" | "rejected";

export function ReviewModerationActions({
  reviewId,
  siteSlug = "gpt-store",
  listStatus = "pending",
}: {
  reviewId: string;
  siteSlug?: string;
  listStatus?: ListStatus;
}) {
  const [loading, setLoading] = useState<"approve" | "reject" | "delete" | null>(null);
  const router = useRouter();

  async function callApi(action: "approve" | "reject" | "delete") {
    const api =
      siteSlug === "subs-store" ? "/api/admin/subs-store/reviews" : "/api/admin/reviews";
    const res = await fetch(api, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: reviewId, action, site: siteSlug }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? "Ошибка");
    }
  }

  async function moderate(action: "approve" | "reject") {
    setLoading(action);
    try {
      await callApi(action);
      router.refresh();
    } catch {
      /* noop */
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
  );
}
