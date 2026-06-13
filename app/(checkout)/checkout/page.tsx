import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutFlow } from "@/app/(checkout)/checkout/CheckoutFlow";
import { CheckoutVisitMetrika } from "@/components/analytics/CheckoutVisitMetrika";
import { getStoreConfig, splitPlans, type StoreConfig } from "@/lib/store-config";
import { CHATGPT_PLANS } from "@/lib/chatgpt-data";
import { withTimeout } from "@/lib/server/withTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Оформление заказа",
  description: "Оплата подписки ChatGPT Plus / Pro",
};

const FALLBACK_CONFIG: StoreConfig = {
  plans: [...CHATGPT_PLANS.plus, ...CHATGPT_PLANS.pro],
  promoCodes: [],
  landingSections: { showReviews: true, showFaq: true, showCompare: true },
  landingDiscounts: [],
};

export default async function CheckoutPage() {
  const storeConfig = await withTimeout(getStoreConfig(), 5000, FALLBACK_CONFIG);
  const split = splitPlans(storeConfig.plans);
  const plans = [...(split.plus ?? CHATGPT_PLANS.plus), ...(split.pro ?? CHATGPT_PLANS.pro)];

  return (
    <>
      <Suspense fallback={null}>
        <CheckoutVisitMetrika store="gpt" />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
            Загрузка…
          </div>
        }
      >
        <CheckoutFlow initialPlans={plans} />
      </Suspense>
    </>
  );
}
