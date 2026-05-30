import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";
import { CheckoutAfterPaymentRedirect } from "@/components/checkout/CheckoutAfterPaymentRedirect";
import { CheckoutSuccessOrderRedirect } from "@/components/checkout/CheckoutSuccessOrderRedirect";
import { buildCustomerOrderFocusHref } from "@/lib/dashboard/customer-order-view";
import { isPaidLikeStatus } from "@/lib/orders/paid-like-status";
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

  const dashboardOrdersHref = buildCustomerOrderFocusHref(siteSlug, orderId);

  if (siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (subs) {
      const { data: subsOrder } = await subs
        .from("orders")
        .select("status,payment_status")
        .eq("id", orderId)
        .maybeSingle();

      if (subsOrder) {
        const isPaid =
          subsOrder.payment_status === "paid" ||
          isPaidLikeStatus(String(subsOrder.status), "subs-store");
        if (isPaid) {
          redirect(dashboardOrdersHref);
        }
      }
    }
  } else {
    const supabase = await createClient();
    const { data: order } = await supabase
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle();

    if (order && isPaidLikeStatus(String(order.status), "gpt-store")) {
      redirect(dashboardOrdersHref);
    }
  }

  return (
    <Suspense fallback={<div className="text-center text-sm text-gray-500">Подтверждаем оплату…</div>}>
      <CheckoutAfterPaymentRedirect orderId={orderId} siteSlug={siteSlug} />
    </Suspense>
  );
}
