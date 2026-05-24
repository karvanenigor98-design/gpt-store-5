"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

type Props = {
  siteSlug: SiteSlug;
  /** В кабинете — без отступа сверху и на всю ширину контейнера */
  embedded?: boolean;
};

const SITE_META: Record<
  SiteSlug,
  { accent: string; loginHref: string; returnPath: string; brand: string }
> = {
  "gpt-store": {
    accent: "#10a37f",
    loginHref: "/login?site=gpt-store",
    returnPath: "/",
    brand: "GPT STORE",
  },
  "subs-store": {
    accent: "#1DB954",
    loginHref: "/login?site=subs-store",
    returnPath: "/spotify",
    brand: "SPOTIFY STORE",
  },
};

export function LandingReviewSubmitPanel({ siteSlug, embedded = false }: Props) {
  const meta = SITE_META[siteSlug];
  const isDark = siteSlug === "subs-store";

  const [rating, setRating] = useState(5);
  const [authorName, setAuthorName] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedAuth(false);

    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          site: siteSlug,
          rating,
          content,
          author_name: authorName.trim() || undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        needAuth?: boolean;
        ok?: boolean;
      };

      if (!res.ok || !j.ok) {
        setError(j.error ?? "Не удалось отправить отзыв");
        setNeedAuth(Boolean(j.needAuth));
        return;
      }

      setDone(true);
      setContent("");
      setAuthorName("");
      setRating(5);
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const loginHref = `${meta.loginHref}&returnUrl=${encodeURIComponent(meta.returnPath)}`;

  return (
    <div
      className={cn(
        "rounded-2xl border p-6 shadow-sm md:p-8",
        embedded ? "w-full max-w-2xl" : "mx-auto mt-12 max-w-xl",
        isDark ? "border-white/10 bg-[#141414]" : "border-black/[0.07] bg-white",
      )}
    >
      <h3 className={cn("font-heading text-xl font-bold", isDark ? "text-white" : "text-gray-900")}>
        Оставить отзыв
      </h3>
      <p className={cn("mt-1 text-sm", isDark ? "text-gray-400" : "text-gray-500")}>
        Отзыв сразу попадёт администратору на модерацию. После одобрения появится на этой странице.
      </p>

      {done ? (
        <p
          className="mt-4 rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: `${meta.accent}18`,
            color: meta.accent,
            border: `1px solid ${meta.accent}35`,
          }}
        >
          Спасибо! Отзыв отправлен — мы проверим его в ближайшее время.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className={cn("mb-2 block text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
              Ваше имя
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={80}
              className={cn(
                "w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-shadow",
                isDark
                  ? "border-white/15 bg-white/5 text-white placeholder:text-gray-500 focus:border-[#1DB954]"
                  : "border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#10a37f] focus:ring-2 focus:ring-[#10a37f]/20",
              )}
              placeholder="Как вас подписать в отзыве"
            />
            <p className={cn("mt-1 text-xs", isDark ? "text-gray-500" : "text-gray-400")}>
              Если вы вошли в аккаунт, подставим имя из профиля автоматически.
            </p>
          </div>

          <div>
            <label className={cn("mb-2 block text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
              Оценка
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="rounded p-0.5 transition-transform hover:scale-110"
                  aria-label={`${n} из 5`}
                >
                  <Star
                    size={28}
                    className={cn(
                      n <= rating ? "fill-amber-400 text-amber-400" : isDark ? "text-gray-600" : "text-gray-200",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={cn("mb-2 block text-sm font-medium", isDark ? "text-gray-300" : "text-gray-700")}>
              Текст отзыва
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              required
              minLength={10}
              className={cn(
                "w-full resize-y rounded-xl border px-3.5 py-2.5 text-sm outline-none transition-shadow",
                isDark
                  ? "border-white/15 bg-white/5 text-white placeholder:text-gray-500 focus:border-[#1DB954]"
                  : "border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#10a37f] focus:ring-2 focus:ring-[#10a37f]/20",
              )}
              placeholder="Расскажите о вашем опыте с подпиской…"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
              {needAuth && (
                <p className="mt-2">
                  <Link href={loginHref} className="font-semibold underline" style={{ color: meta.accent }}>
                    Войти в {meta.brand}
                  </Link>
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: meta.accent, boxShadow: `0 4px 16px ${meta.accent}44` }}
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Отправка…" : "Отправить отзыв"}
          </button>
        </form>
      )}
    </div>
  );
}
