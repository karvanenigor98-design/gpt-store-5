import type { Metadata } from "next";
import { XCircle } from "lucide-react";

import { SpotifyFunnelFailGoal } from "@/components/analytics/SpotifyFunnelFailGoal";
import { CheckoutFailActions } from "@/components/checkout/CheckoutFailActions";
import { resolveCheckoutSiteSlug } from "@/lib/payments/resolve-checkout-site";

export const metadata: Metadata = { title: "Ошибка оплаты" };

export default async function CheckoutFailPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const params = await searchParams;
  const siteSlug = await resolveCheckoutSiteSlug(params.site);
  const isSubs = siteSlug === "subs-store";
  const accent = isSubs ? "#1DB954" : "#10a37f";
  const homeHref = isSubs ? "/spotify" : "/";
  const ordersHref = `/dashboard/orders?site=${siteSlug}`;

  return (
    <>
      <SpotifyFunnelFailGoal siteSlug={isSubs ? "subs-store" : "gpt-store"} />
    <div className="w-full max-w-sm text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
        <XCircle size={28} className="text-red-400" />
      </div>
      <h1 className="font-heading text-2xl font-bold text-gray-900 mb-3">Оплата не прошла</h1>
      <p className="text-sm text-gray-500 mb-6">
        Что-то пошло не так во время проведения платежа. Заказ сохранён — можно завершить оплату из
        личного кабинета.
      </p>
      <CheckoutFailActions
        siteSlug={siteSlug}
        accent={accent}
        ordersHref={ordersHref}
        homeHref={homeHref}
        homeLabel={isSubs ? "На главную SPOTIFY STORE" : "На главную GPT STORE"}
      />
    </div>
    </>
  );
}
