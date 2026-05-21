"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-white text-gray-900">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
          <p className="text-sm text-gray-600">
            Попробуйте обновить страницу или повторить действие позже.
          </p>
          {error?.digest ? <p className="text-xs text-gray-400">Код ошибки: {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-[#10a37f] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Обновить
          </button>
        </main>
      </body>
    </html>
  );
}
