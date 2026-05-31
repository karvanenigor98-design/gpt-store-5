"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="font-heading text-xl font-bold text-gray-900">Не удалось открыть кабинет</h1>
      <p className="mt-3 text-sm text-gray-600">
        Обновите страницу. Если ошибка повторяется — возможно, на сервере не настроены переменные Supabase (
        <code className="rounded bg-gray-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> должен быть{" "}
        <code className="rounded bg-gray-100 px-1">*.supabase.co</code>, не домен сайта, и{" "}
        <code className="rounded bg-gray-100 px-1">SUPABASE_SERVICE_ROLE_KEY</code>).
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-gray-400">Код ошибки: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-xl bg-[#10a37f] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Попробовать снова
      </button>
    </div>
  );
}
