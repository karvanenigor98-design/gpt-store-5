"use client";

export function StaffAuthFailed({
  title = "Не удалось проверить сессию",
  loginHref,
}: {
  title?: string;
  loginHref: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-xl font-bold text-gray-900">{title}</h1>
        <p className="mt-3 text-sm text-gray-600">
          Сессия не подтвердилась за отведённое время. Это не означает, что доступ снят — повторите
          запрос или войдите снова.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className="inline-block rounded-xl bg-[#10a37f] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Повторить
          </button>
          <a
            href={loginHref}
            className="inline-block rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Войти снова
          </a>
        </div>
      </div>
    </div>
  );
}
