"use client";

import { useEffect } from "react";

export function StaffAuthFailed({
  title = "Не удалось проверить сессию",
  loginHref,
}: {
  title?: string;
  loginHref: string;
}) {
  useEffect(() => {
    const key = "staff-auth-auto-retry";
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    const t = window.setTimeout(() => window.location.reload(), 400);
    return () => window.clearTimeout(t);
  }, []);

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
              sessionStorage.removeItem("staff-auth-auto-retry");
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
