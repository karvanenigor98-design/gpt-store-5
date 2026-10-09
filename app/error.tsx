"use client";

import { useEffect } from "react";

import { hardOpenHome, reloadOnceForStaleChunk } from "@/lib/chunk-error-reload";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reloadOnceForStaleChunk(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-2xl font-bold text-gray-900">Не удалось загрузить страницу</h1>
      <p className="mt-3 max-w-md text-sm text-gray-600">
        Кэш браузера держит старую версию сайта. Откройте главную заново или нажмите Ctrl+F5.
      </p>
      <button
        type="button"
        onClick={() => hardOpenHome()}
        className="mt-8 rounded-xl bg-[#10a37f] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        На главную
      </button>
    </div>
  );
}
