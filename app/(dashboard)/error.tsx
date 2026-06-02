"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-xl font-bold text-gray-900">Не удалось открыть кабинет</h1>
      <p className="mt-3 max-w-md text-sm text-gray-600">
        Попробуйте обновить страницу или войдите заново. Остальные разделы сайта должны работать.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-[#10a37f] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Попробовать снова
        </button>
        <Link
          href="/login?site=gpt-store"
          className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          На страницу входа
        </Link>
      </div>
    </div>
  );
}
