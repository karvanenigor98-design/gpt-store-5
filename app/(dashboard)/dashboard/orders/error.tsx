"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function OrdersPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard/orders]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-amber-500/30 bg-amber-500/10 px-6 py-8 text-center">
      <h2 className="text-lg font-bold text-white">Не удалось открыть заказ</h2>
      <p className="mt-2 text-sm text-gray-300">
        Войдите в кабинет Spotify Store тем же email, что указывали при оформлении, и откройте раздел
        заказов.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-[#1DB954] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Попробовать снова
        </button>
        <Link
          href="/dashboard/orders?site=subs-store"
          className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          Все заказы
        </Link>
        <Link
          href="/login?site=subs-store&returnUrl=%2Fdashboard%2Forders%3Fsite%3Dsubs-store"
          className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          Войти
        </Link>
      </div>
    </div>
  );
}
