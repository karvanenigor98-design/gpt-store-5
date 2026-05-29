import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { SiteSlug } from "@/lib/auth/siteUiSession";
import { resolveCustomerSiteSlug } from "@/lib/auth/resolveCustomerSiteSlug";

export const metadata: Metadata = { title: "Статус заказа" };

/** Обратная совместимость: /dashboard/order/:id → история заказов с подсветкой. */
export default async function CustomerOrderStatusRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ site?: string }>;
}) {
  const { orderId } = await params;
  const sp = await searchParams;

  const siteSlug: SiteSlug = await resolveCustomerSiteSlug({
    siteParam: sp.site,
    pathname: "/dashboard/order",
  });

  redirect(`/dashboard/orders?site=${siteSlug}&order_id=${encodeURIComponent(orderId)}`);
}
