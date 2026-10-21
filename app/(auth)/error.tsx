"use client";

import { useEffect } from "react";

import { hardReloadCurrentPage, reloadOnceForStaleChunk } from "@/lib/chunk-error-reload";

export default function AuthError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[auth]", error);
    reloadOnceForStaleChunk(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="font-heading text-xl font-bold text-gray-900">Не удалось открыть вход</h1>
      <p className="mt-3 max-w-md text-sm text-gray-600">
        Обновите страницу. Если ошибка повторится — откройте ссылку в режиме инкогнито.
      </p>
      <button
        type="button"
        onClick={() => hardReloadCurrentPage()}
        className="mt-6 rounded-xl bg-[#10a37f] px-5 py-2.5 text-sm font-semibold text-white"
      >
        Обновить страницу
      </button>
    </div>
  );
}
