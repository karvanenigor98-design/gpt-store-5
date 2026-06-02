"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

export default function OrdersPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const searchParams = useSearchParams();
  const site = searchParams.get("site") === "gpt-store" ? "gpt-store" : "subs-store";
  const orderId = searchParams.get("order_id") ?? searchParams.get("highlight") ?? "";
  const ordersHref = `/dashboard/orders?site=${site}${orderId ? `&order_id=${encodeURIComponent(orderId)}` : ""}`;
  const loginReturn = encodeURIComponent(ordersHref);
  const isSubs = site === "subs-store";

  useEffect(() => {
    console.error("[dashboard/orders]", error);
  }, [error]);

  const brand = useMemo(() => (isSubs ? "Spotify STORE" : "GPT STORE"), [isSubs]);

  return (
    <div
      className={`mx-auto max-w-lg rounded-2xl border px-6 py-8 text-center ${
        isSubs ? "border-amber-500/30 bg-amber-500/10" : "border-amber-200 bg-amber-50"
      }`}
    >
      <h2 className={`text-lg font-bold ${isSubs ? "text-white" : "text-gray-900"}`}>
        Не удалось открыть заказ
      </h2>
      <p className={`mt-2 text-sm ${isSubs ? "text-gray-300" : "text-gray-600"}`}>
        Войдите в кабинет {brand} тем же email, что указывали при оформлении, затем откройте раздел
        заказов.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 ${
            isSubs ? "bg-[#1DB954]" : "bg-[#10a37f]"
          }`}
        >
          Попробовать снова
        </button>
        <Link
          href={ordersHref}
          className={`rounded-xl border px-5 py-2.5 text-sm font-semibold hover:bg-black/5 ${
            isSubs ? "border-white/20 text-white hover:bg-white/10" : "border-gray-200 text-gray-800"
          }`}
        >
          {orderId ? "К заказу" : "Все заказы"}
        </Link>
        <Link
          href={`/login?site=${site}&returnUrl=${loginReturn}`}
          className={`rounded-xl border px-5 py-2.5 text-sm font-semibold ${
            isSubs ? "border-white/20 text-white hover:bg-white/10" : "border-gray-200 text-gray-800"
          }`}
        >
          Войти
        </Link>
      </div>
    </div>
  );
}
