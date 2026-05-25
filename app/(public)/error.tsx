"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[gpt-landing]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
      <p className="font-heading mb-2 text-xl font-bold text-gray-900">Не удалось загрузить страницу</p>
      <p className="mb-6 max-w-md text-sm text-gray-500">
        Попробуйте обновить страницу. Если вы на локальном сервере и ошибка не уходит — освободите
        место на диске C: (нужно хотя бы 2–3 ГБ) и перезапустите{" "}
        <code className="text-xs">npm run dev:gpt</code>.
      </p>
      {process.env.NODE_ENV === "development" && error.message && (
        <p className="mb-4 max-w-lg rounded-lg bg-red-50 px-3 py-2 text-left text-xs text-red-700">
          {error.message}
        </p>
      )}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-[#10a37f] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Повторить
        </button>
        <Link href="/" className="text-sm text-[#10a37f] hover:underline">
          На главную
        </Link>
      </div>
    </div>
  );
}
