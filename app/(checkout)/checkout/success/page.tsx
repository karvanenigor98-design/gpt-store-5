import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutAfterPaymentRedirect } from "@/components/checkout/CheckoutAfterPaymentRedirect";
import { CheckoutSuccessOrderRedirect } from "@/components/checkout/CheckoutSuccessOrderRedirect";
import { reconcileUnpaidOrderPayment } from "@/lib/payments/reconcile-unpaid-order";
import { resolveCheckoutSuccessContext } from "@/lib/payments/resolve-success-order-id";

export const metadata: Metadata = { title: "Оплата получена" };
export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    order?: string;
    orderId?: string;
    order_id?: string;
    orderid?: string;
    site?: string;
    InvId?: string;
    inv_id?: string;
    invoice_id?: string;
    bill_id?: string;
  }>;
}

export default async function CheckoutSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const { orderId, siteSlug } = await resolveCheckoutSuccessContext(params);

  if (!orderId) {
    return (
      <Suspense
        fallback={
          <div className="text-center text-sm text-gray-500">Переходим в кабинет…</div>
        }
      >
        <CheckoutSuccessOrderRedirect />
      </Suspense>
    );
  }

  await reconcileUnpaidOrderPayment({ siteSlug, orderId }).catch(() => undefined);

  return (
    <Suspense fallback={<div className="text-center text-sm text-gray-500">Подтверждаем оплату…</div>}>
      <CheckoutAfterPaymentRedirect orderId={orderId} siteSlug={siteSlug} />
    </Suspense>
  );
}
