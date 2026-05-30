import {
  isCustomerOrderPaidLike,
  resolveCustomerOrderStatus,
} from "@/lib/dashboard/resolve-customer-order-status";
import { customerOrderStatusLabelRu } from "@/lib/dashboard/customer-order-status-display";
import type { SiteSlug } from "@/lib/sites";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export type CheckoutOrderPaymentState = {
  status: string;
  paymentStatus?: string | null;
  effectiveStatus: string;
  displayStatus: string;
  paidLike: boolean;
};

export async function getCheckoutOrderPaymentState(
  siteSlug: SiteSlug,
  orderId: string,
): Promise<CheckoutOrderPaymentState | null> {
  if (siteSlug === "subs-store") {
    const subs = createSubsStoreAdminClient();
    if (!subs) return null;

    const { data: order } = await subs
      .from("orders")
      .select("status,payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return null;

    const status = String(order.status ?? "awaiting_payment");
    const paymentStatus = order.payment_status ?? null;
    const effectiveStatus = resolveCustomerOrderStatus({
      siteSlug: "subs-store",
      status,
      paymentStatus,
    });
    const paidLike = isCustomerOrderPaidLike({
      siteSlug: "subs-store",
      status,
      paymentStatus,
    });

    return {
      status,
      paymentStatus,
      effectiveStatus,
      displayStatus: customerOrderStatusLabelRu("subs-store", effectiveStatus),
      paidLike,
    };
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const status = String(order.status ?? "pending");
  const effectiveStatus = resolveCustomerOrderStatus({
    siteSlug: "gpt-store",
    status,
  });
  const paidLike = isCustomerOrderPaidLike({ siteSlug: "gpt-store", status });

  return {
    status,
    effectiveStatus,
    displayStatus: customerOrderStatusLabelRu("gpt-store", effectiveStatus),
    paidLike,
  };
}
