import type { SiteSlug } from "@/lib/sites";
import { isPaidLikeStatus } from "@/lib/orders/paid-like-status";
import { createAdminClient } from "@/lib/supabase/server";
import { createSubsStoreAdminClient } from "@/lib/supabase/subs-store-admin";

export type CheckoutOrderPaymentState = {
  status: string;
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
    const paidLike =
      order.payment_status === "paid" || isPaidLikeStatus(status, "subs-store");

    return { status, paidLike };
  }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const status = String(order.status ?? "pending");
  return { status, paidLike: isPaidLikeStatus(status, "gpt-store") };
}
