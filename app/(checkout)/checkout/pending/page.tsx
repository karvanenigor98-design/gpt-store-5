import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { CheckoutPaymentWait } from "@/components/checkout/CheckoutPaymentWait";
import type { SiteSlug } from "@/lib/auth/siteUiSession";

export const metadata: Metadata = { title: "Ожидание оплаты" };
export const dynamic = "force-dynamic";

function PendingContent({
  orderId,
  siteSlug,
}: {
  orderId: string;
  siteSlug: SiteSlug;
}) {
  return <CheckoutPaymentWait orderId={orderId} siteSlug={siteSlug} />;
}

export default async function CheckoutPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; orderId?: string; site?: string }>;
}) {
  const params = await searchParams;
  const orderId = (params.order ?? params.orderId ?? "").trim();
  const siteSlug: SiteSlug = params.site === "subs-store" ? "subs-store" : "gpt-store";

  if (!orderId) {
    redirect(siteSlug === "subs-store" ? "/checkout/spotify" : "/checkout");
  }

  return (
    <Suspense
      fallback={
        <div className="text-center text-sm text-gray-500">Загрузка…</div>
      }
    >
      <PendingContent orderId={orderId} siteSlug={siteSlug} />
    </Suspense>
  );
}
