import type { Metadata } from "next";
import { XCircle } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Ошибка оплаты" };

export default async function CheckoutFailPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const isSubs = params.site === "subs-store";
  const accent = isSubs ? "#1DB954" : "#10a37f";
  const checkoutHref = isSubs ? "/checkout/spotify" : "/checkout";
  const homeHref = isSubs ? "/spotify" : "/";
  const ordersHref = `/dashboard/orders?site=${isSubs ? "subs-store" : "gpt-store"}`;

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <XCircle size={28} className="text-red-400" />
      </div>
      <h1 className="font-heading text-2xl font-bold text-gray-900 mb-3">Оплата не прошла</h1>
      <p className="text-sm text-gray-500 mb-6">
        Что-то пошло не так во время проведения платежа. Заказ сохранён — можно завершить оплату из
        личного кабинета.
      </p>
      <div className="space-y-2">
        <Link
          href={checkoutHref}
          className="block w-full rounded-xl py-3 text-sm font-semibold text-white text-center hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          Попробовать снова
        </Link>
        <Link
          href={ordersHref}
          className="block w-full rounded-xl border border-black/[0.1] py-3 text-sm text-gray-600 text-center hover:bg-gray-50"
        >
          Мои заказы
        </Link>
        <Link
          href={homeHref}
          className="block w-full rounded-xl py-3 text-sm text-gray-500 text-center hover:text-gray-800"
        >
          {isSubs ? "На главную SPOTIFY STORE" : "На главную GPT STORE"}
        </Link>
      </div>
    </div>
  );
}
