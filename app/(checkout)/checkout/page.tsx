import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutFlow } from "@/app/(checkout)/checkout/CheckoutFlow";
import { CheckoutVisitMetrika } from "@/components/analytics/CheckoutVisitMetrika";

export const metadata: Metadata = {
  title: "Оформление заказа",
  description: "Оплата подписки ChatGPT Plus / Pro",
};

/** Тарифы подтягивает CheckoutFlow с /api/public/store-config — без блокирующего SSR. */
export default function CheckoutPage() {
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
        <CheckoutFlow />
      </Suspense>
    </>
  );
}
