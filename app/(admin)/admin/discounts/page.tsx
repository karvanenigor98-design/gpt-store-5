import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/requireAdminPage";
import { DiscountsManager } from "./DiscountsManager";
import { resolveAdminSiteSlug } from "@/lib/admin/siteFilter";
import { getSiteBySlug } from "@/lib/sites";

export const metadata: Metadata = { title: "Admin · Скидки" };

export default async function AdminDiscountsPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  const siteSlug = resolveAdminSiteSlug(params);
  const site = getSiteBySlug(siteSlug);

  return (
    <div className="p-6">
      <h1 className="mb-2 font-heading text-2xl font-bold text-gray-900">
        Скидки на лендинге
        <span className="ml-3 text-base font-normal" style={{ color: site.primaryColor }}>
          {site.brandName}
        </span>
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        Отображаются на блоке тарифов (витрина). Не путать с промокодом при оформлении заказа.
      </p>
      <DiscountsManager siteSlug={siteSlug} />
    </div>
  );
}
