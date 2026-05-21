"use client";

import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ReviewSubmitFormProps = {
  siteSlug?: "gpt-store" | "subs-store";
};

export function ReviewSubmitForm({ siteSlug = "gpt-store" }: ReviewSubmitFormProps) {
  const isSubs = siteSlug === "subs-store";
  const accent = isSubs ? "#1DB954" : "#10a37f";

  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ site: siteSlug, rating, content }),
      });
      const j = (await r.json()) as { error?: string; ok?: boolean };
      if (!r.ok) {
        toast.error(j.error ?? "Не удалось отправить отзыв");
        return;
      }
      toast.success("Отзыв отправлен на модерацию");
      setContent("");
      setRating(5);
    } catch {
      toast.error("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-2xl border p-5 shadow-sm",
        isSubs ? "border-white/10 bg-[#161616]" : "border-black/10 bg-white",
      )}
    >
      <h3 className={cn("font-heading text-lg font-bold", isSubs ? "text-white" : "text-gray-900")}>
        Оставить отзыв
      </h3>
      <p className={cn("mt-1 text-sm", isSubs ? "text-gray-400" : "text-gray-500")}>
        Отзыв появится на лендинге после проверки администратором.
      </p>

      <div className="mt-4">
        <label className={cn("mb-2 block text-sm font-medium", isSubs ? "text-gray-300" : "text-gray-700")}>
          Оценка
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              className={cn(
                "text-2xl transition-colors",
                n <= rating ? "text-amber-400" : isSubs ? "text-gray-600" : "text-gray-200",
              )}
              aria-label={`${n} звёзд`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label className={cn("mb-2 block text-sm font-medium", isSubs ? "text-gray-300" : "text-gray-700")}>
          Текст отзыва
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          required
          minLength={10}
          className={cn(
            "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2",
            isSubs
              ? "border-white/10 bg-[#111111] text-gray-100 placeholder:text-gray-600 focus:border-[#1DB954] focus:ring-[#1DB954]/25"
              : "border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#10a37f] focus:ring-[#10a37f]/20",
          )}
          placeholder="Расскажите о вашем опыте..."
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        style={{ backgroundColor: accent }}
      >
        {loading ? "Отправка…" : "Отправить на модерацию"}
      </button>
    </form>
  );
}
