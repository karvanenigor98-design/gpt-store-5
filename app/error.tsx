"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";
  const detail = [error.message, error.digest ? `digest: ${error.digest}` : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-2xl font-bold text-gray-900">Не удалось загрузить страницу</h1>
      <p className="mt-3 max-w-md text-sm text-gray-600">
        {isDev ? (
          <>
            Попробуйте обновить. Если сообщение повторяется — остановите все окна с{" "}
            <code className="rounded bg-gray-100 px-1">npm run dev</code>, удалите папку{" "}
            <code className="rounded bg-gray-100 px-1">.next</code> и снова запустите{" "}
            <code className="rounded bg-gray-100 px-1">npm run dev:clean</code>.
          </>
        ) : (
          <>Попробуйте обновить страницу. Если ошибка повторяется — напишите в поддержку в личном кабинете.</>
        )}
      </p>
      {detail ? (
        <p className="mt-4 max-w-lg break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-[11px] text-gray-700">
          {detail}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 rounded-xl bg-[#10a37f] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        Попробовать снова
      </button>
    </div>
  );
}
