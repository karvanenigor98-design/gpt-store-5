import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutFlow } from "@/app/(checkout)/checkout/CheckoutFlow";
import { getStoreConfig, splitPlans } from "@/lib/store-config";
import { CHATGPT_PLANS } from "@/lib/chatgpt-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Оформление заказа",
  description: "Оплата подписки ChatGPT Plus / Pro",
};

export default async function CheckoutPage() {
  const storeConfig = await getStoreConfig();
  const split = splitPlans(storeConfig.plans);
  const plans = [...(split.plus ?? CHATGPT_PLANS.plus), ...(split.pro ?? CHATGPT_PLANS.pro)];

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
          Загрузка…
        </div>
      }
    >
      <CheckoutFlow initialPlans={plans} />
    </Suspense>
  );
}
